import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeService } from '../services/theme.service';
import { FormsModule } from '@angular/forms';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import { startOfDay } from 'date-fns';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { KeycloakService } from 'keycloak-angular';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    CalendarModule
  ]
})
export class DashboardComponent {
  view: CalendarView = CalendarView.Month;
  CalendarView = CalendarView;
  viewDate: Date = new Date();
  events: CalendarEvent[] = [
    {
      start: startOfDay(new Date()),
      title: 'Exemple d\'événement',
      color: { primary: '#3C91E6', secondary: '#CFE8FF' }
    }
  ];
  
  currentDate: string = '';
  showCalendrier = false;
  isDarkMode: boolean = false;
  calendarVisible = false;

  constructor(private keycloakService: KeycloakService,
    private themeService: ThemeService
  ) {
    this.themeService.isDarkMode$.subscribe(
      (isDark: boolean) => this.isDarkMode = isDark
    );
  }

  ngOnInit() {
    this.addSideMenuClickListener();
    this.toggleSidebar();
    this.toggleSearchForm();
    this.handleResponsiveDesign();
   
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        this.isDarkMode = true;
        document.body.setAttribute('data-theme', 'dark');
        document.body.style.backgroundColor = 'var(--grey)';
      } else {
        this.isDarkMode = false;
        document.body.setAttribute('data-theme', 'light');
        document.body.style.backgroundColor = 'var(--light)';
      }
    }
    
  

  addSideMenuClickListener() {
    const allSideMenu = document.querySelectorAll('#sidebar .side-menu.top li a');
  
    allSideMenu.forEach(item => {
      const li = item.parentElement;
      
      if (li) {
        item.addEventListener('click', function () {
          allSideMenu.forEach(i => {
            const parent = i.parentElement;
            if (parent) {
              parent.classList.remove('active');
            }
          });
          li.classList.add('active');
        });
      }
    });
  }
  

  toggleSidebar() {
    const menuBar = document.querySelector('#content nav .bx.bx-menu');
    const sidebar = document.getElementById('sidebar');
    
    menuBar?.addEventListener('click', function () {
      sidebar?.classList.toggle('hide');
    });
  }

  toggleSearchForm() {
    const searchButton = document.querySelector('#content nav form .form-input button');
    const searchButtonIcon = document.querySelector('#content nav form .form-input button .bx');
    const searchForm = document.querySelector('#content nav form');
    
    searchButton?.addEventListener('click', function (e) {
      if (window.innerWidth < 576) {
        e.preventDefault();
        searchForm?.classList.toggle('show');
        if (searchForm?.classList.contains('show')) {
          searchButtonIcon?.classList.replace('bx-search', 'bx-x');
        } else {
          searchButtonIcon?.classList.replace('bx-x', 'bx-search');
        }
      }
    });
  }

  handleResponsiveDesign() {
    const sidebar = document.getElementById('sidebar');
    const searchButtonIcon = document.querySelector('#content nav form .form-input button .bx');
    const searchForm = document.querySelector('#content nav form');

    if (window.innerWidth < 768) {
      sidebar?.classList.add('hide');
    } else if (window.innerWidth > 576) {
      searchButtonIcon?.classList.replace('bx-x', 'bx-search');
      searchForm?.classList.remove('show');
    }

    window.addEventListener('resize', function () {
      if (window.innerWidth > 576) {
        searchButtonIcon?.classList.replace('bx-x', 'bx-search');
        searchForm?.classList.remove('show');
      }
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
  
  

  getCurrentDate() {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return today.toLocaleDateString('fr-FR', options);
  }

  toggleCalendar() {
    this.calendarVisible = !this.calendarVisible;
    const calendarElement = document.getElementById('calendarSection');
    if (calendarElement) {
      if (this.calendarVisible) {
        calendarElement.classList.add('show');
      } else {
        calendarElement.classList.remove('show');
      }
    }
  }
  

  setView(view: CalendarView) {
    this.view = view;
  }
  logout(){
    this.keycloakService.logout();
  }
}
