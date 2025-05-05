import { Component } from '@angular/core';
import { NgbCalendar, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'app-calendrier',
    templateUrl: './calendrier.component.html',
    styleUrls: ['./calendrier.component.css'],
    standalone: false
})
export class CalendrierComponent {
  model: NgbDateStruct;
  date: { year: number, month: number };
  isDarkMode: boolean = false;
  calendarVisible: boolean = true;

  constructor(private calendar: NgbCalendar) {
    this.model = this.calendar.getToday();
    this.date = { year: this.model.year, month: this.model.month };
  }
  
  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    const theme = this.isDarkMode ? 'dark' : 'light';
    
    // Applique l'attribut 'data-theme' sur le dashboard-container
    const dashboardContainer = document.querySelector('.dashboard-container');
    if (dashboardContainer) {
      dashboardContainer.setAttribute('data-theme', theme);
    }
  
    // Sauvegarde le thème dans le localStorage
    localStorage.setItem('theme', theme);
  }
  
  toggleCalendar() {
    this.calendarVisible = !this.calendarVisible;
    console.log('Calendar visibility toggled:', this.calendarVisible);
  }
}
