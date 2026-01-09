// ============== Enums ==============

export enum Tradition {
  CARNATIC = 'carnatic',
  HINDUSTANI = 'hindustani',
}

// Base entity interface (might be useful for future expansion)
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
