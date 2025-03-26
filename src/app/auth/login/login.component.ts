import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  errorMessage: string = '';

  constructor(private router: Router) {}

  login() {
    // Vous pouvez ajouter la logique de validation et de connexion ici
    if (this.email === 'test@example.com' && this.password === 'password') {
      this.router.navigate(['/dashboard']); // Redirige vers le tableau de bord
    } else {
      this.errorMessage = 'Email ou mot de passe incorrect';
    }
  }
}
