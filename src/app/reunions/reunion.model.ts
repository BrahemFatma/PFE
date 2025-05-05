// src/app/services/reunion/reunion.model.ts
export interface Reunion {
    id?: number;
    titre: string;
    description: string;
    date: Date;
    heure: string;
    lieu: string;
    pv: string;
    documents?: File;
    status: string;
}