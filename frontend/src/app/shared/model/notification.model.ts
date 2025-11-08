export interface TypeNotify {
  id: number;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notify {
  id: number;
  title: string;
  message: string;
  type: TypeNotify;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}