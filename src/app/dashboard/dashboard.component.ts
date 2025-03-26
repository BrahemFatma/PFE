import { Component, OnInit, Renderer2 } from '@angular/core';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import { startOfDay } from 'date-fns';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
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
  isDarkMode = false;
  calendarVisible = false;

  constructor(private renderer: Renderer2) {
    this.currentDate = this.getCurrentDate();
    const savedTheme = localStorage.getItem('theme');
    this.isDarkMode = savedTheme === 'dark';
    if (this.isDarkMode) {
      this.renderer.addClass(document.body, 'dark');
    }
  }

  ngOnInit() {
    this.addSideMenuClickListener();
    this.toggleSidebar();
    this.toggleSearchForm();
    this.handleResponsiveDesign();
  }

  // Méthode pour gérer les événements sur le menu latéral
  addSideMenuClickListener() {
    const allSideMenu = document.querySelectorAll('#sidebar .side-menu.top li a');
  
    allSideMenu.forEach(item => {
      const li = item.parentElement;
      
      if (li) {  // Vérification que 'li' n'est pas null
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
  

  // TOGGLE SIDEBAR
  toggleSidebar() {
    const menuBar = document.querySelector('#content nav .bx.bx-menu');
    const sidebar = document.getElementById('sidebar');
    
    menuBar?.addEventListener('click', function () {
      sidebar?.classList.toggle('hide');
    });
  }

  // Gérer l'affichage du formulaire de recherche
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

  // Gérer la responsivité
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

  // Toggle theme
  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      this.renderer.addClass(document.body, 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      this.renderer.removeClass(document.body, 'dark');
      localStorage.setItem('theme', 'light');
    }
  }

  // Méthode pour obtenir la date actuelle
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
        calendarElement.classList.add('show'); // Affiche le calendrier avec animation
      } else {
        calendarElement.classList.remove('show'); // Cache le calendrier avec animation
      }
    }
  }
  

  setView(view: CalendarView) {
    this.view = view;
  }
}
