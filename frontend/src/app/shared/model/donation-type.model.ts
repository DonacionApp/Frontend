export interface DonationType {
  id: string;
  name: string;
  type?: string; // Campo 'type' original del backend (para enviar de vuelta)
  description?: string;
  icon?: string;
  createdAt?: string;
  updatedAt?: string;
}

