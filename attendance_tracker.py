import tkinter as tk
from tkinter import messagebox
import json
import os
from datetime import datetime, timedelta

# File where attendance data will be saved locally
DATA_FILE = "attendance_data.json"

class AttendanceApp(tk.Tk):
    def __init__(self):
        super().__init__()

        # --- Window Setup ---
        self.title("Attendance Tracker")
        # Set a mobile-friendly aspect ratio (approx 9:16)
        self.geometry("400x700")
        # Light gray background for a clean, modern look
        self.configure(bg="#F4F6F9")

        # --- Data Initialization ---
        self.attendance_data = self.load_data()
        self.current_date = datetime.today().date()

        # --- UI Construction ---
        self.setup_ui()
        self.update_dashboard()
        self.update_history()

    def load_data(self):
        """Loads attendance data from a local JSON file."""
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, "r") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading data: {e}")
        return {} # Return empty dict if file doesn't exist or is corrupted

    def save_data(self):
        """Saves current attendance data to the local JSON file."""
        try:
            with open(DATA_FILE, "w") as f:
                json.dump(self.attendance_data, f, indent=4)
        except Exception as e:
            print(f"Error saving data: {e}")
            messagebox.showerror("Error", "Could not save data locally.")

    def setup_ui(self):
        """Builds the user interface components."""
        # Common fonts
        font_title = ("Helvetica", 20, "bold")
        font_normal = ("Helvetica", 14)
        font_small = ("Helvetica", 12)

        # --- 1. Dashboard (Top Card) ---
        # Using frames with white backgrounds to simulate UI "cards"
        dash_frame = tk.Frame(self, bg="white", bd=0, relief=tk.FLAT)
        dash_frame.pack(fill=tk.X, padx=15, pady=15)

        tk.Label(dash_frame, text="Dashboard", font=font_title, bg="white", fg="#333").pack(pady=(10, 5))

        self.lbl_present = tk.Label(dash_frame, text="Total Present: 0", font=font_normal, bg="white", fg="#555")
        self.lbl_present.pack()

        self.lbl_total = tk.Label(dash_frame, text="Total Logged: 0", font=font_normal, bg="white", fg="#555")
        self.lbl_total.pack()

        self.lbl_percent = tk.Label(dash_frame, text="Percentage: 0%", font=("Helvetica", 18, "bold"), bg="white", fg="#555")
        self.lbl_percent.pack(pady=(5, 10))

        # --- 2. Action Area (Middle Card) ---
        action_frame = tk.Frame(self, bg="white")
        action_frame.pack(fill=tk.X, padx=15, pady=(0, 15))

        # Date Navigator (Previous Day, Current Day, Next Day)
        date_nav_frame = tk.Frame(action_frame, bg="white")
        date_nav_frame.pack(pady=10)

        btn_prev = tk.Button(date_nav_frame, text=" < ", font=font_normal, command=self.prev_day, bg="#E9ECEF", relief=tk.FLAT)
        btn_prev.pack(side=tk.LEFT, padx=10)

        self.lbl_date = tk.Label(date_nav_frame, text=self.format_date(self.current_date), font=font_normal, bg="white", width=12)
        self.lbl_date.pack(side=tk.LEFT)

        btn_next = tk.Button(date_nav_frame, text=" > ", font=font_normal, command=self.next_day, bg="#E9ECEF", relief=tk.FLAT)
        btn_next.pack(side=tk.LEFT, padx=10)

        # Action Buttons (Mark Present / Mark Absent)
        btn_frame = tk.Frame(action_frame, bg="white")
        btn_frame.pack(pady=10, fill=tk.X, padx=20)

        btn_present = tk.Button(btn_frame, text="Mark Present", font=font_normal, bg="#28A745", fg="white", relief=tk.FLAT, command=lambda: self.mark_attendance("Present"))
        btn_present.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(0, 5), ipady=10)

        btn_absent = tk.Button(btn_frame, text="Mark Absent", font=font_normal, bg="#DC3545", fg="white", relief=tk.FLAT, command=lambda: self.mark_attendance("Absent"))
        btn_absent.pack(side=tk.RIGHT, expand=True, fill=tk.X, padx=(5, 0), ipady=10)

        # --- 3. History Area (Bottom Card) ---
        history_frame = tk.Frame(self, bg="white")
        history_frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=(0, 15))

        tk.Label(history_frame, text="History", font=font_title, bg="white", fg="#333").pack(pady=(10, 5))

        # Scrollable Listbox for past records
        list_frame = tk.Frame(history_frame, bg="white")
        list_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))

        scrollbar = tk.Scrollbar(list_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.history_listbox = tk.Listbox(list_frame, font=font_small, yscrollcommand=scrollbar.set, relief=tk.FLAT, selectbackground="#007BFF")
        self.history_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.history_listbox.yview)

        # Delete Entry Button
        btn_delete = tk.Button(history_frame, text="Delete Selected Entry", font=font_small, bg="#6C757D", fg="white", relief=tk.FLAT, command=self.delete_entry)
        btn_delete.pack(fill=tk.X, padx=10, pady=(0, 10), ipady=5)

    def format_date(self, d):
        """Formats the date string, showing 'Today' if it matches current system date."""
        if d == datetime.today().date():
            return f"Today, {d.strftime('%b %d')}"
        return d.strftime('%Y-%m-%d')

    def prev_day(self):
        """Navigates to the previous day."""
        self.current_date -= timedelta(days=1)
        self.lbl_date.config(text=self.format_date(self.current_date))

    def next_day(self):
        """Navigates to the next day."""
        self.current_date += timedelta(days=1)
        self.lbl_date.config(text=self.format_date(self.current_date))

    def mark_attendance(self, status):
        """Records attendance for the currently selected date."""
        date_str = str(self.current_date)

        # Check for duplicate entry / overwrite confirmation
        if date_str in self.attendance_data:
            if not messagebox.askyesno("Overwrite", f"Attendance for {date_str} is already marked as {self.attendance_data[date_str]}.\nDo you want to overwrite it?"):
                return

        # Save state and update UI
        self.attendance_data[date_str] = status
        self.save_data()
        self.update_dashboard()
        self.update_history()

        # Reset view to 'Today' automatically after logging
        self.current_date = datetime.today().date()
        self.lbl_date.config(text=self.format_date(self.current_date))

    def delete_entry(self):
        """Deletes the selected entry from the history listbox."""
        selected = self.history_listbox.curselection()
        if not selected:
            messagebox.showinfo("Select Entry", "Please select an entry from the history to delete.")
            return

        # Parse the date from the listbox item (Format: "YYYY-MM-DD : Status")
        item = self.history_listbox.get(selected[0])
        date_str = item.split(" : ")[0]

        # Confirm deletion
        if messagebox.askyesno("Delete", f"Are you sure you want to delete the entry for {date_str}?"):
            if date_str in self.attendance_data:
                del self.attendance_data[date_str]
                self.save_data()
                self.update_dashboard()
                self.update_history()

    def update_dashboard(self):
        """Recalculates statistics and updates dashboard labels."""
        total_logged = len(self.attendance_data)
        total_present = sum(1 for status in self.attendance_data.values() if status == "Present")

        self.lbl_present.config(text=f"Total Present: {total_present}")
        self.lbl_total.config(text=f"Total Logged: {total_logged}")

        # Calculate percentage
        percentage = (total_present / total_logged * 100) if total_logged > 0 else 0.0
        self.lbl_percent.config(text=f"Percentage: {percentage:.1f}%")

        # Color coding: Green if >= 75%, Red if below
        if percentage >= 75:
            self.lbl_percent.config(fg="#28A745") # Success Green
        else:
            self.lbl_percent.config(fg="#DC3545") # Danger Red

    def update_history(self):
        """Refreshes the history listbox with latest data sorted by date."""
        self.history_listbox.delete(0, tk.END)

        # Sort dates descending (newest entries first)
        sorted_dates = sorted(self.attendance_data.keys(), reverse=True)

        for d in sorted_dates:
            self.history_listbox.insert(tk.END, f"{d} : {self.attendance_data[d]}")

            # Apply color coding to the listbox items based on status
            if self.attendance_data[d] == "Present":
                self.history_listbox.itemconfig(tk.END, {'fg': '#28A745'})
            else:
                self.history_listbox.itemconfig(tk.END, {'fg': '#DC3545'})

if __name__ == "__main__":
    app = AttendanceApp()
    app.mainloop()
