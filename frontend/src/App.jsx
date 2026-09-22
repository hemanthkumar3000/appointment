import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";

function App() {
  const [appointments, setAppointments] = useState([]);
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [message, setMessage] = useState(null);

  const [formMode, setFormMode] = useState("add"); // add | edit
  const [currentId, setCurrentId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    start_time: "",
    end_time: "",
  });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchAppointments();
  }, [filterDate, filterStatus]);

  async function fetchAppointments() {
    try {
      const params = {};
      if (filterDate) params.date = filterDate;
      if (filterStatus) params.status = filterStatus;
      const res = await axios.get(`${API}/appointments`, { params });
      setAppointments(res.data);
    } catch (e) {
      setMessage({ type: "error", text: "Failed to load appointments." });
    }
  }

  function showMessage(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  function resetForm() {
    setFormMode("add");
    setCurrentId(null);
    setFormData({
      title: "",
      description: "",
      date: "",
      start_time: "",
      end_time: "",
    });
    setFormError("");
  }

  function handleEdit(ap) {
  setFormMode("edit");
  setCurrentId(ap.id);
  setFormData({
    title: ap.title,
    description: ap.description || "",
    date: ap.date,
    start_time: ap.start_time,
    end_time: ap.end_time,
  });
  setFormError("");
}

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    const { title, date, start_time, end_time } = formData;
    if (!title || !date || !start_time || !end_time) {
      setFormError("Please fill all required fields.");
      return;
    }
    if (end_time <= start_time) {
      setFormError("End time must be after start time.");
      return;
    }

    try {
      if (formMode === "add") {
        await axios.post(`${API}/appointments`, formData);
        showMessage("success", "Appointment added successfully.");
      } else {
        await axios.put(`${API}/appointments/${currentId}`, formData);
        showMessage("success", "Appointment updated successfully.");
      }
      resetForm();
      fetchAppointments();
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        (formMode === "add"
          ? "Failed to add appointment."
          : "Failed to update appointment.");
      setFormError(msg);
      showMessage("error", msg);
    }
  }

  async function handleComplete(id) {
    try {
      await axios.patch(`${API}/appointments/${id}/complete`);
      showMessage("success", "Appointment marked as completed.");
      fetchAppointments();
    } catch (err) {
      const msg = err.response?.data?.detail || "Cannot complete this appointment.";
      showMessage("error", msg);
    }
  }

  async function handleCancel(id) {
    try {
      await axios.patch(`${API}/appointments/${id}/cancel`);
      showMessage("success", "Appointment cancelled.");
      fetchAppointments();
    } catch (err) {
      const msg = err.response?.data?.detail || "Cannot cancel this appointment.";
      showMessage("error", msg);
    }
  }

  function statusBadge(status) {
    const base = "px-2 py-1 rounded text-xs font-medium";
    if (status === "completed") return <span className={`${base} bg-green-100 text-green-800`}>Completed</span>;
    if (status === "cancelled") return <span className={`${base} bg-red-100 text-red-800`}>Cancelled</span>;
    return <span className={`${base} bg-blue-100 text-blue-800`}>Scheduled</span>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold mb-4">Appointment Board</h1>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <label className="flex items-center gap-2">
          Date:
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          Status:
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <button
          onClick={() => {
            setFilterDate("");
            setFilterStatus("");
          }}
          className="text-sm text-blue-600 underline"
        >
          Clear filters
        </button>
      </div>

      {/* Form */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-3">
          {formMode === "add" ? "Add Appointment" : "Edit Appointment"}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Title *"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="border rounded px-3 py-2"
          />
          <input
            type="text"
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="border rounded px-3 py-2"
          />
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="border rounded px-3 py-2"
          />
          <div className="flex gap-2">
            <input
              type="time"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              className="border rounded px-3 py-2 w-full"
              placeholder="Start time"
            />
            <input
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              className="border rounded px-3 py-2 w-full"
              placeholder="End time"
            />
          </div>

          {formError && (
            <div className="col-span-1 md:col-span-2 text-red-600 text-sm">{formError}</div>
          )}

          <div className="col-span-1 md:col-span-2 flex gap-2">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              {formMode === "add" ? "Add Appointment" : "Save Changes"}
            </button>
            {formMode === "edit" && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">Appointments</h2>
        {appointments.length === 0 ? (
          <p className="text-gray-500">No appointments found.</p>
        ) : (
          <ul className="space-y-3">
            {appointments.map((ap) => (
              <li
                key={ap.id}
                className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ap.title}</span>
                    {statusBadge(ap.status)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {ap.date} • {ap.start_time}–{ap.end_time}
                  </div>
                  {ap.description && (
                    <div className="text-sm text-gray-700 mt-1">{ap.description}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(ap)}
                    className="text-blue-600 hover:underline text-sm"
                    disabled={ap.status === "cancelled"}
                  >
                    Edit
                  </button>
                  {ap.status === "scheduled" && (
                    <>
                      <button
                        onClick={() => handleComplete(ap.id)}
                        className="text-green-600 hover:underline text-sm"
                      >
                        Complete
                      </button>
                      <button
                        onClick={() => handleCancel(ap.id)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 text-sm text-gray-600">
        <h3 className="font-semibold mb-2">How this works (brief)</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Backend: FastAPI + SQLite stores appointments.</li>
          <li>Frontend: React calls the API to list, add, edit, complete, and cancel appointments.</li>
          <li>Time-slot conflicts are checked on the server for all non-cancelled appointments.</li>
          <li>Cancelled appointments remain visible with a “Cancelled” label.</li>
        </ul>
      </div>
    </div>
  );
}

export default App;