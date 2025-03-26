import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CalendrierComponent } from './calendrier/calendrier.component';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ReunionsComponent } from './reunions/reunions.component';
import { InterventionsComponent } from './interventions/interventions.component';
import { RoutinesComponent } from './routines/routines.component';
import { UtilisateursComponent } from './utilisateurs/utilisateurs.component';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';

const routes: Routes = [
  { path: 'calendrier', component: CalendrierComponent },

  { path: 'dashboard', component: DashboardComponent }, 
  { path: 'reunions', component: ReunionsComponent }, 
  { path: 'interventions', component: InterventionsComponent }, 
  { path: 'routines', component: RoutinesComponent }, 
  { path: 'utilisateurs', component: UtilisateursComponent },
  { path: 'auth/login', component: LoginComponent }, 
  { path: 'auth/register', component: RegisterComponent },  
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', component: PageNotFoundComponent } 
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
