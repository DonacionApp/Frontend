export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastNotification {
  id?: number;
  title: string;
  message: string;
  type?: ToastType;
  link?: string;
  createdAt?: string;
  duration?: number; // ms
}
