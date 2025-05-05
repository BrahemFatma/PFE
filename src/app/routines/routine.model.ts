export interface Routine {
    id?: number;
    nomTache: string;
    nom?: string;
    description: string;
    dateDebut: Date;
    dateFin: Date;
    statut: StatutRoutine;
    userId: number | null; // Ensure userId is nullable to handle cases where no user is selected
    user?: User | null; // Ensure user can be null if not provided
    users?: User[] | null; // Ensure users array can be null if not provided
}

export interface User {
    id: number;
    nom: string;
    prenom: string;
    email?: string;
}

export enum StatutRoutine {
    A_FAIRE = 'A_FAIRE',
    EN_COURS = 'EN_COURS',
    TERMINE = 'TERMINE'
}

// Add a utility function to validate User objects
export function validateUser(user: User): User {
    return {
        id: user.id,
        nom: user.nom || 'Nom inconnu',
        prenom: user.prenom || 'Prénom inconnu',
        email: user.email || ''
    };
}