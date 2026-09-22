# Appointment Board

A simple full-stack appointment board for a small team.

## Features

- View, add, edit, complete, and cancel appointments
- Filter by date and status
- Prevents double-booking of time slots
- Cancelled appointments remain visible and clearly marked
- Sample data preloaded for quick review

## Tech Stack

- Backend: Python, FastAPI, SQLite (SQLAlchemy)
- Frontend: React, Vite, Tailwind CSS (CDN)

## How to Run

### Backend

```bash
cd backend
python -m venv venv
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
pip install fastapi uvicorn sqlalchemy pydantic
uvicorn main:app --reload
```

Backend runs at: http://localhost:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

## Assumptions

- Times are in 24-hour `HH:MM` format; dates in `YYYY-MM-DD`.
- Overlap check applies only to non-cancelled appointments.
- Completed appointments cannot be cancelled; cancelled appointments cannot be completed.

## API Endpoints (brief)

- `GET /appointments?date=YYYY-MM-DD&status=scheduled|completed|cancelled`
- `POST /appointments`
- `GET /appointments/{id}`
- `PUT /appointments/{id}`
- `PATCH /appointments/{id}/complete`
- `PATCH /appointments/{id}/cancel`