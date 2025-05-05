export enum StatutIntervention {
    EN_ATTENTE = 'EN_ATTENTE',
    EN_COURS = 'EN_COURS',
    TERMINEE = 'TERMINEE'
}

export interface Utilisateur {
    nomUtilisateur: string;
    service: string;
    pointsADiscuter: string[] | string;
}

export interface Responsable {
    id: number;
    nom: string;
    prenom: string;
    role?: string;
}

export interface Intervention {
    id?: number;
    clientId: number;  // Changed from client to clientId
    objectif: string;
    description?: string;  // Optional field for backwards compatibility
    date: Date | string;
    statut: string;
    userId?: number;
    heureDebutVisite?: string;
    heureFinVisite?: string;
    actionsMiseEnPlace?: string;
    responsable?: Array<Responsable>;
    utilisateurs?: Array<Utilisateur>;
    client?: string;  // Added to store client name after fetching
}
