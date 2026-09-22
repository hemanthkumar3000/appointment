from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, Boolean
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime
from typing import List, Optional

app = FastAPI(title="Appointment Board API")

# CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SQLite DB
SQLALCHEMY_DATABASE_URL = "sqlite:///./appointments.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AppointmentModel(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    start_time = Column(String, nullable=False)  # HH:MM
    end_time = Column(String, nullable=False)  # HH:MM
    status = Column(String, default="scheduled")  # scheduled, completed, cancelled
    completed = Column(Boolean, default=False)
    cancelled = Column(Boolean, default=False)

Base.metadata.create_all(bind=engine)

# Pydantic schemas
class AppointmentCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = ""
    date: str
    start_time: str
    end_time: str

class AppointmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None

class AppointmentResponse(AppointmentCreate):
    id: int
    status: str
    completed: bool
    cancelled: bool

    class Config:
        from_attributes = True

# Helpers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def time_to_minutes(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m

def has_overlap(date: str, start: str, end: str, exclude_id: Optional[int] = None) -> bool:
    db = SessionLocal()
    try:
        q = db.query(AppointmentModel).filter(
            AppointmentModel.date == date,
            AppointmentModel.cancelled == False
        )
        if exclude_id is not None:
            q = q.filter(AppointmentModel.id != exclude_id)
        appointments = q.all()
        new_start = time_to_minutes(start)
        new_end = time_to_minutes(end)
        for ap in appointments:
            if ap.status == "cancelled":
                continue
            s = time_to_minutes(ap.start_time)
            e = time_to_minutes(ap.end_time)
            # Overlap if intervals intersect
            if not (new_end <= s or new_start >= e):
                return True
        return False
    finally:
        db.close()

# Seed sample data (run once)
def seed_sample_data():
    db = SessionLocal()
    try:
        if db.query(AppointmentModel).count() == 0:
            samples = [
                AppointmentModel(
                    title="Team Standup",
                    description="Daily sync",
                    date="2026-09-23",
                    start_time="10:00",
                    end_time="10:30",
                    status="scheduled"
                ),
                AppointmentModel(
                    title="Client Call",
                    description="Project kickoff",
                    date="2026-09-23",
                    start_time="11:00",
                    end_time="12:00",
                    status="scheduled"
                ),
                AppointmentModel(
                    title="Code Review",
                    description="Review PRs",
                    date="2026-09-24",
                    start_time="15:00",
                    end_time="16:00",
                    status="completed",
                    completed=True
                ),
                AppointmentModel(
                    title="Cancelled Meeting",
                    description="Rescheduled",
                    date="2026-09-22",
                    start_time="14:00",
                    end_time="14:30",
                    status="cancelled",
                    cancelled=True
                ),
            ]
            db.add_all(samples)
            db.commit()
    finally:
        db.close()

seed_sample_data()

# Routes
@app.get("/appointments", response_model=List[AppointmentResponse])
def list_appointments(date: Optional[str] = None, status: Optional[str] = None):
    db = SessionLocal()
    try:
        q = db.query(AppointmentModel)
        if date:
            q = q.filter(AppointmentModel.date == date)
        if status:
            q = q.filter(AppointmentModel.status == status)
        return q.order_by(AppointmentModel.date, AppointmentModel.start_time).all()
    finally:
        db.close()

@app.post("/appointments", response_model=AppointmentResponse)
def create_appointment(ap: AppointmentCreate):
    # Basic validation
    if ap.end_time <= ap.start_time:
        raise HTTPException(status_code=400, detail="End time must be after start time.")
    if has_overlap(ap.date, ap.start_time, ap.end_time):
        raise HTTPException(status_code=409, detail="Time slot already booked.")

    db = SessionLocal()
    try:
        new_ap = AppointmentModel(**ap.dict(), status="scheduled")
        db.add(new_ap)
        db.commit()
        db.refresh(new_ap)
        return new_ap
    finally:
        db.close()

@app.get("/appointments/{ap_id}", response_model=AppointmentResponse)
def get_appointment(ap_id: int):
    db = SessionLocal()
    try:
        ap = db.query(AppointmentModel).filter(AppointmentModel.id == ap_id).first()
        if not ap:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        return ap
    finally:
        db.close()

@app.put("/appointments/{ap_id}", response_model=AppointmentResponse)
def update_appointment(ap_id: int, ap_update: AppointmentUpdate):
    db = SessionLocal()
    try:
        ap = db.query(AppointmentModel).filter(AppointmentModel.id == ap_id).first()
        if not ap:
            raise HTTPException(status_code=404, detail="Appointment not found.")

        # Build candidate values
        new_title = ap_update.title if ap_update.title is not None else ap.title
        new_desc = ap_update.description if ap_update.description is not None else ap.description
        new_date = ap_update.date if ap_update.date is not None else ap.date
        new_start = ap_update.start_time if ap_update.start_time is not None else ap.start_time
        new_end = ap_update.end_time if ap_update.end_time is not None else ap.end_time

        if new_end <= new_start:
            raise HTTPException(status_code=400, detail="End time must be after start time.")

        # Check overlap excluding current appointment
        if (new_date != ap.date or new_start != ap.start_time or new_end != ap.end_time):
            if has_overlap(new_date, new_start, new_end, exclude_id=ap.id):
                raise HTTPException(status_code=409, detail="Time slot already booked.")

        ap.title = new_title
        ap.description = new_desc
        ap.date = new_date
        ap.start_time = new_start
        ap.end_time = new_end
        db.commit()
        db.refresh(ap)
        return ap
    finally:
        db.close()

@app.patch("/appointments/{ap_id}/complete", response_model=AppointmentResponse)
def complete_appointment(ap_id: int):
    db = SessionLocal()
    try:
        ap = db.query(AppointmentModel).filter(AppointmentModel.id == ap_id).first()
        if not ap:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if ap.cancelled:
            raise HTTPException(status_code=400, detail="Cannot complete a cancelled appointment.")
        ap.completed = True
        ap.status = "completed"
        db.commit()
        db.refresh(ap)
        return ap
    finally:
        db.close()

@app.patch("/appointments/{ap_id}/cancel", response_model=AppointmentResponse)
def cancel_appointment(ap_id: int):
    db = SessionLocal()
    try:
        ap = db.query(AppointmentModel).filter(AppointmentModel.id == ap_id).first()
        if not ap:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        if ap.completed:
            raise HTTPException(status_code=400, detail="Cannot cancel a completed appointment.")
        ap.cancelled = True
        ap.status = "cancelled"
        db.commit()
        db.refresh(ap)
        return ap
    finally:
        db.close()

@app.delete("/appointments/{ap_id}")
def delete_appointment(ap_id: int):
    # Optional: if you want hard delete; otherwise skip this endpoint
    db = SessionLocal()
    try:
        ap = db.query(AppointmentModel).filter(AppointmentModel.id == ap_id).first()
        if not ap:
            raise HTTPException(status_code=404, detail="Appointment not found.")
        db.delete(ap)
        db.commit()
        return {"detail": "Appointment deleted."}
    finally:
        db.close()