import { Component } from '@angular/core';
import { NgbCalendar, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-calendrier',
  templateUrl: './calendrier.component.html',
  styleUrls: ['./calendrier.component.css']
})
export class CalendrierComponent {
  model: NgbDateStruct;
  date: { year: number, month: number };

  constructor(private calendar: NgbCalendar) {
    this.model = this.calendar.getToday();
    this.date = { year: this.model.year, month: this.model.month };
  }
}
