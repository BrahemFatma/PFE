import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'pfe';
  currentDate: string = ''; 
   // Initialisation avec une valeur par défaut (une chaîne vide)
  showCalendrier = false;
  constructor() {
    this.currentDate = this.getCurrentDate(); // Appel de la méthode pour obtenir la date
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
}
