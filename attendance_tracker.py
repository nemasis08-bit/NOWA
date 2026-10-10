import tkinter as tk
from tkinter import messagebox
import json
import os
from datetime import datetime, timedelta

DATA_FILE = "attendance_data.json"

class AttendanceApp(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("Attendance Tracker - Premium Glass UI")
        self.geometry("400x700")

        # Base dark background for "anime/tech" vibe
        self.bg_color = "#0B0C10"
        self.configure(bg=self.bg_color)

        self.attendance_data = self.load_data()
        self.current_date = datetime.today().date()

        self.setup_ui()
        self.update_dashboard()
        self.update_history()

    def load_data(self):
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, "r") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading data: {e}")
        return {}

    def save_data(self):
        try:
            with open(DATA_FILE, "w") as f:
                json.dump(self.attendance_data, f, indent=4)
        except Exception as e:
            print(f"Error saving data: {e}")
            messagebox.showerror("Error", "Could not save data locally.")

    def create_glass_card(self, parent, **kwargs):
        """Creates a stylized frame acting as a 'glass' panel"""
        # Glass effect via slightly lighter dark background and bright accent borders
        card = tk.Frame(parent, bg="#1F2833", highlightbackground="#66FCF1", highlightthickness=1, **kwargs)
        return card

    def setup_ui(self):
        # Premium Fonts
        font_title = ("Helvetica", 22, "bold")
        font_normal = ("Helvetica", 14)
        font_small = ("Helvetica", 12)
        font_accent = ("Helvetica", 20, "italic bold")

        # Main wrapper to add padding
        main_frame = tk.Frame(self, bg=self.bg_color)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        # Header Title
        lbl_header = tk.Label(main_frame, text="ATTENDANCE // SYSTEM", font=font_accent, bg=self.bg_color, fg="#66FCF1")
        lbl_header.pack(pady=(0, 20))

        # --- 1. Dashboard (Glass Card) ---
        dash_frame = self.create_glass_card(main_frame)
        dash_frame.pack(fill=tk.X, pady=(0, 15), ipady=10)

        tk.Label(dash_frame, text="DASHBOARD", font=("Helvetica", 14, "bold"), bg="#1F2833", fg="#C5C6C7").pack(pady=(10, 5))

        self.lbl_present = tk.Label(dash_frame, text="Total Present: 0", font=font_normal, bg="#1F2833", fg="#E0E2E4")
        self.lbl_present.pack()

        self.lbl_total = tk.Label(dash_frame, text="Total Logged: 0", font=font_normal, bg="#1F2833", fg="#E0E2E4")
        self.lbl_total.pack()

        self.lbl_percent = tk.Label(dash_frame, text="0.0%", font=("Helvetica", 28, "bold"), bg="#1F2833", fg="#45A29E")
        self.lbl_percent.pack(pady=(10, 10))

        # --- 2. Action Area (Glass Card) ---
        action_frame = self.create_glass_card(main_frame)
        action_frame.pack(fill=tk.X, pady=(0, 15), ipady=10)

        tk.Label(action_frame, text="LOG ENTRY", font=("Helvetica", 14, "bold"), bg="#1F2833", fg="#C5C6C7").pack(pady=(10, 5))

        # Date Navigator
        date_nav_frame = tk.Frame(action_frame, bg="#1F2833")
        date_nav_frame.pack(pady=10)

        # Custom styled buttons
        btn_style = {"bg": "#0B0C10", "fg": "#66FCF1", "font": font_normal, "activebackground": "#45A29E", "activeforeground": "white", "relief": tk.FLAT, "bd": 1, "highlightbackground": "#66FCF1", "highlightthickness": 1}

        btn_prev = tk.Button(date_nav_frame, text=" < ", command=self.prev_day, **btn_style)
        btn_prev.pack(side=tk.LEFT, padx=10)

        self.lbl_date = tk.Label(date_nav_frame, text=self.format_date(self.current_date), font=font_normal, bg="#1F2833", fg="white", width=14)
        self.lbl_date.pack(side=tk.LEFT)

        btn_next = tk.Button(date_nav_frame, text=" > ", command=self.next_day, **btn_style)
        btn_next.pack(side=tk.LEFT, padx=10)

        # Action Buttons (Mark Present / Mark Absent)
        btn_frame = tk.Frame(action_frame, bg="#1F2833")
        btn_frame.pack(pady=15, fill=tk.X, padx=20)

        # Present: Cyber Green/Cyan
        btn_present = tk.Button(btn_frame, text="PRESENT", font=("Helvetica", 12, "bold"), bg="#45A29E", fg="white", activebackground="#66FCF1", activeforeground="#0B0C10", relief=tk.FLAT, command=lambda: self.mark_attendance("Present"))
        btn_present.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(0, 5), ipady=10)

        # Absent: Neon Pink/Red vibe
        btn_absent = tk.Button(btn_frame, text="ABSENT", font=("Helvetica", 12, "bold"), bg="#E94560", fg="white", activebackground="#FF6B81", activeforeground="white", relief=tk.FLAT, command=lambda: self.mark_attendance("Absent"))
        btn_absent.pack(side=tk.RIGHT, expand=True, fill=tk.X, padx=(5, 0), ipady=10)

        # --- 3. History Area (Glass Card) ---
        history_frame = self.create_glass_card(main_frame)
        history_frame.pack(fill=tk.BOTH, expand=True)

        tk.Label(history_frame, text="DATABASE LOGS", font=("Helvetica", 14, "bold"), bg="#1F2833", fg="#C5C6C7").pack(pady=(10, 5))

        # Scrollable Listbox for past records
        list_frame = tk.Frame(history_frame, bg="#1F2833")
        list_frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=(0, 10))

        scrollbar = tk.Scrollbar(list_frame, bg="#0B0C10", troughcolor="#1F2833")
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.history_listbox = tk.Listbox(list_frame, font=font_small, bg="#0B0C10", fg="#66FCF1", yscrollcommand=scrollbar.set, relief=tk.FLAT, selectbackground="#45A29E", selectforeground="white", bd=0, highlightthickness=0)
        self.history_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.history_listbox.yview)

        # Delete Entry Button
        btn_delete = tk.Button(history_frame, text="DELETE ENTRY", font=("Helvetica", 10, "bold"), bg="#C5C6C7", fg="#0B0C10", activebackground="white", activeforeground="#0B0C10", relief=tk.FLAT, command=self.delete_entry)
        btn_delete.pack(fill=tk.X, padx=15, pady=15, ipady=5)

    def format_date(self, d):
        if d == datetime.today().date():
            return f"[ TODAY ]"
        return d.strftime('%Y - %m - %d')

    def prev_day(self):
        self.current_date -= timedelta(days=1)
        self.lbl_date.config(text=self.format_date(self.current_date))

    def next_day(self):
        self.current_date += timedelta(days=1)
        self.lbl_date.config(text=self.format_date(self.current_date))

    def mark_attendance(self, status):
        date_str = str(self.current_date)
        if date_str in self.attendance_data:
            if not messagebox.askyesno("System Override", f"Record for {date_str} exists [{self.attendance_data[date_str]}].\nInitiate overwrite?"):
                return

        self.attendance_data[date_str] = status
        self.save_data()
        self.update_dashboard()
        self.update_history()

        self.current_date = datetime.today().date()
        self.lbl_date.config(text=self.format_date(self.current_date))

    def delete_entry(self):
        selected = self.history_listbox.curselection()
        if not selected:
            messagebox.showinfo("Target Required", "Select an entry from the database logs to purge.")
            return

        item = self.history_listbox.get(selected[0])
        date_str = item.split(" >> ")[0].strip()

        if messagebox.askyesno("Confirm Purge", f"Purge record for {date_str}?"):
            if date_str in self.attendance_data:
                del self.attendance_data[date_str]
                self.save_data()
                self.update_dashboard()
                self.update_history()

    def update_dashboard(self):
        total_logged = len(self.attendance_data)
        total_present = sum(1 for status in self.attendance_data.values() if status == "Present")

        self.lbl_present.config(text=f"Total Present: {total_present}")
        self.lbl_total.config(text=f"Total Logged: {total_logged}")

        percentage = (total_present / total_logged * 100) if total_logged > 0 else 0.0
        self.lbl_percent.config(text=f"{percentage:.1f}%")

        if percentage >= 75:
            self.lbl_percent.config(fg="#66FCF1") # Neon Cyan
        else:
            self.lbl_percent.config(fg="#E94560") # Neon Red/Pink

    def update_history(self):
        self.history_listbox.delete(0, tk.END)
        sorted_dates = sorted(self.attendance_data.keys(), reverse=True)

        for d in sorted_dates:
            status = self.attendance_data[d]
            self.history_listbox.insert(tk.END, f"{d}  >>  {status}")

            if status == "Present":
                self.history_listbox.itemconfig(tk.END, {'fg': '#66FCF1'})
            else:
                self.history_listbox.itemconfig(tk.END, {'fg': '#E94560'})

if __name__ == "__main__":
    app = AttendanceApp()
    app.mainloop()
