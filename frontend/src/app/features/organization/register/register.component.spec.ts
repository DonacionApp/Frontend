import { OrganizationRegisterComponent } from './register.component';
import { FormBuilder } from '@angular/forms';

describe('OrganizationRegisterComponent (file validations)', () => {
  let component: OrganizationRegisterComponent;

  beforeEach(() => {
    const fb = new FormBuilder();
    // Mock services with minimal shape
    const mockRegService: any = { getCountries: () => ({ subscribe: () => {} }) };
    const mockRouter: any = { navigate: () => {} };
    const mockState: any = { setSuccessMessage: () => {} };
    component = new OrganizationRegisterComponent(fb as any, mockRegService, mockRouter, mockState);
  });

  it('should reject files larger than 5MB', () => {
    const bigBlob = new Blob([new ArrayBuffer(6 * 1024 * 1024)], { type: 'application/pdf' });
    const bigFile = new File([bigBlob], 'big.pdf', { type: 'application/pdf' });
    const meta = { file: bigFile, name: bigFile.name, progress: 0, error: null } as any;
    const valid = component.validateFile(meta);
    expect(valid).toBeFalse();
    expect(meta.error).toContain('demasiado grande');
  });

  it('should reject disallowed mime types', () => {
    const blob = new Blob([new ArrayBuffer(1000)], { type: 'text/plain' });
    const file = new File([blob], 'notes.txt', { type: 'text/plain' });
    const meta = { file, name: file.name, progress: 0, error: null } as any;
    const valid = component.validateFile(meta);
    expect(valid).toBeFalse();
    expect(meta.error).toContain('no permitido');
  });

  it('should accept valid pdf/jpg/png under limit', () => {
    const blob = new Blob([new ArrayBuffer(1024)], { type: 'application/pdf' });
    const file = new File([blob], 'ok.pdf', { type: 'application/pdf' });
    const meta = { file, name: file.name, progress: 0, error: null } as any;
    const valid = component.validateFile(meta);
    expect(valid).toBeTrue();
    expect(meta.error).toBeNull();
  });
});
