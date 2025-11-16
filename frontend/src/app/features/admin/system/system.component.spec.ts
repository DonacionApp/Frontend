import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { SystemComponent } from './system.component';
import { SystemService, ExpirationConfig, BackupConfig, BackupStatus } from '../../../core/services/system.service';

describe('SystemComponent', () => {
  let component: SystemComponent;
  let fixture: ComponentFixture<SystemComponent>;
  let systemService: jasmine.SpyObj<SystemService>;

  beforeEach(async () => {
    const systemServiceSpy = jasmine.createSpyObj('SystemService', [
      'getPolicies',
      'updatePolicies',
      'getTerms',
      'updateTerms',
      'getAboutUs',
      'updateAboutUs',
      'getExpirationConfig',
      'updateExpirationConfig',
      'getBackupConfig',
      'updateBackupConfig',
      'triggerBackup',
      'getBackupStatus',
      'getBackupHistory',
      'downloadBackup',
      'deleteBackup'
    ]);

    await TestBed.configureTestingModule({
      imports: [SystemComponent, ReactiveFormsModule, HttpClientTestingModule],
      providers: [{ provide: SystemService, useValue: systemServiceSpy }]
    }).compileComponents();

    systemService = TestBed.inject(SystemService) as jasmine.SpyObj<SystemService>;
    fixture = TestBed.createComponent(SystemComponent);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize forms with default values', () => {
      expect(component.policiesForm).toBeDefined();
      expect(component.termsForm).toBeDefined();
      expect(component.aboutUsForm).toBeDefined();
      expect(component.expirationForm).toBeDefined();
      expect(component.backupConfigForm).toBeDefined();
    });

    it('should set active tab to policies by default', () => {
      expect(component.activeTab).toBe('policies');
    });

    it('should load all content on init', () => {
      systemService.getPolicies.and.returnValue(of({ policies: 'Test policies' }));
      systemService.getTerms.and.returnValue(of({ terms: 'Test terms' }));
      systemService.getAboutUs.and.returnValue(of({ aboutUs: 'Test about us' }));
      systemService.getExpirationConfig.and.returnValue(of({}));
      systemService.getBackupConfig.and.returnValue(of({ autoBackupEnabled: false }));
      systemService.getBackupHistory.and.returnValue(of([]));

      fixture.detectChanges();

      expect(systemService.getPolicies).toHaveBeenCalled();
      expect(systemService.getTerms).toHaveBeenCalled();
      expect(systemService.getAboutUs).toHaveBeenCalled();
      expect(systemService.getExpirationConfig).toHaveBeenCalled();
      expect(systemService.getBackupConfig).toHaveBeenCalled();
      expect(systemService.getBackupHistory).toHaveBeenCalled();
    });
  });

  describe('Tab Navigation', () => {
    it('should switch to policies tab', () => {
      component.switchTab('policies');
      expect(component.activeTab).toBe('policies');
    });

    it('should switch to terms tab', () => {
      component.switchTab('terms');
      expect(component.activeTab).toBe('terms');
    });

    it('should switch to about-us tab', () => {
      component.switchTab('about-us');
      expect(component.activeTab).toBe('about-us');
    });

    it('should switch to expiration tab', () => {
      component.switchTab('expiration');
      expect(component.activeTab).toBe('expiration');
    });

    it('should switch to backup tab', () => {
      component.switchTab('backup');
      expect(component.activeTab).toBe('backup');
    });

    it('should clear error message when switching tabs', () => {
      component.errorMessage = 'Some error';
      component.switchTab('terms');
      expect(component.errorMessage).toBe('');
    });
  });

  describe('Policies Management', () => {
    it('should load policies successfully', () => {
      const mockPolicies = { policies: 'Test policies content' };
      systemService.getPolicies.and.returnValue(of(mockPolicies));

      component.loadPolicies();

      expect(component.loadingPolicies).toBeFalse();
      expect(component.policiesContent).toBe('Test policies content');
      expect(component.policiesForm.get('content')?.value).toBe('Test policies content');
    });

    it('should handle error when loading policies', () => {
      const error = { error: { message: 'Failed to load policies' } };
      systemService.getPolicies.and.returnValue(throwError(() => error));
      spyOn(window, 'alert');

      component.loadPolicies();

      expect(component.loadingPolicies).toBeFalse();
      expect(window.alert).toHaveBeenCalledWith('Error: Failed to load policies');
    });

    it('should save policies successfully', () => {
      const mockResponse = { policies: 'Updated policies' };
      systemService.updatePolicies.and.returnValue(of(mockResponse));
      spyOn(window, 'alert');

      component.policiesForm.patchValue({ content: 'Updated policies' });
      component.savePolicies();

      expect(systemService.updatePolicies).toHaveBeenCalledWith({ content: 'Updated policies' });
      expect(component.policiesContent).toBe('Updated policies');
      expect(window.alert).toHaveBeenCalledWith('Políticas actualizadas correctamente');
      expect(component.savingPolicies).toBeFalse();
    });

    it('should not save policies with empty content', () => {
      component.policiesForm.patchValue({ content: '' });
      component.savePolicies();

      expect(systemService.updatePolicies).not.toHaveBeenCalled();
      expect(component.policiesForm.get('content')?.touched).toBeTrue();
    });
  });

  describe('Terms Management', () => {
    it('should load terms successfully', () => {
      const mockTerms = { terms: 'Test terms content' };
      systemService.getTerms.and.returnValue(of(mockTerms));

      component.loadTerms();

      expect(component.loadingTerms).toBeFalse();
      expect(component.termsContent).toBe('Test terms content');
      expect(component.termsForm.get('content')?.value).toBe('Test terms content');
    });

    it('should save terms successfully', () => {
      const mockResponse = { terms: 'Updated terms' };
      systemService.updateTerms.and.returnValue(of(mockResponse));
      spyOn(window, 'alert');

      component.termsForm.patchValue({ content: 'Updated terms' });
      component.saveTerms();

      expect(systemService.updateTerms).toHaveBeenCalledWith({ content: 'Updated terms' });
      expect(component.termsContent).toBe('Updated terms');
      expect(window.alert).toHaveBeenCalledWith('Términos y condiciones actualizados correctamente');
    });
  });

  describe('About Us Management', () => {
    it('should load about us successfully', () => {
      const mockAboutUs = { aboutUs: 'Test about us content' };
      systemService.getAboutUs.and.returnValue(of(mockAboutUs));

      component.loadAboutUs();

      expect(component.loadingAboutUs).toBeFalse();
      expect(component.aboutUsContent).toBe('Test about us content');
    });

    it('should save about us successfully', () => {
      const mockResponse = { aboutUs: 'Updated about us' };
      systemService.updateAboutUs.and.returnValue(of(mockResponse));
      spyOn(window, 'alert');

      component.aboutUsForm.patchValue({ content: 'Updated about us' });
      component.saveAboutUs();

      expect(systemService.updateAboutUs).toHaveBeenCalled();
      expect(component.aboutUsContent).toBe('Updated about us');
      expect(window.alert).toHaveBeenCalledWith('Información "Acerca de Nosotros" actualizada correctamente');
    });
  });

  describe('Expiration Configuration', () => {
    it('should load expiration config successfully', () => {
      const mockConfig: ExpirationConfig = {
        expirationIntervalDays: 90,
        policiesExpiresAt: new Date('2025-12-31')
      };
      systemService.getExpirationConfig.and.returnValue(of(mockConfig));

      component.loadExpirationConfig();

      expect(component.loadingExpiration).toBeFalse();
      expect(component.expirationConfig).toEqual(mockConfig);
      expect(component.expirationForm.get('expirationIntervalDays')?.value).toBe(90);
    });

    it('should save expiration config successfully', () => {
      const mockResponse: ExpirationConfig = {
        expirationIntervalDays: 120,
        policiesExpiresAt: new Date('2026-01-15')
      };
      systemService.updateExpirationConfig.and.returnValue(of(mockResponse));
      spyOn(window, 'alert');

      component.expirationForm.patchValue({
        expirationIntervalDays: 120,
        policiesExpiresAt: '2026-01-15'
      });
      component.saveExpirationConfig();

      expect(systemService.updateExpirationConfig).toHaveBeenCalled();
      expect(component.expirationConfig).toEqual(mockResponse);
      expect(window.alert).toHaveBeenCalledWith('Configuración de expiración actualizada correctamente');
    });

    it('should validate expiration interval range', () => {
      component.expirationForm.patchValue({ expirationIntervalDays: 0 });
      expect(component.expirationForm.get('expirationIntervalDays')?.valid).toBeFalse();

      component.expirationForm.patchValue({ expirationIntervalDays: 366 });
      expect(component.expirationForm.get('expirationIntervalDays')?.valid).toBeFalse();

      component.expirationForm.patchValue({ expirationIntervalDays: 90 });
      expect(component.expirationForm.get('expirationIntervalDays')?.valid).toBeTrue();
    });
  });

  describe('Backup Configuration', () => {
    it('should load backup config successfully', () => {
      const mockConfig: BackupConfig = {
        autoBackupEnabled: true,
        backupIntervalDays: 7,
        retentionDays: 90
      };
      systemService.getBackupConfig.and.returnValue(of(mockConfig));

      component.loadBackupConfig();

      expect(component.loadingBackupConfig).toBeFalse();
      expect(component.backupConfig).toEqual(mockConfig);
      expect(component.backupConfigForm.get('autoBackupEnabled')?.value).toBeTrue();
    });

    it('should save backup config successfully', () => {
      const mockResponse: BackupConfig = {
        autoBackupEnabled: true,
        backupIntervalDays: 14,
        retentionDays: 120
      };
      systemService.updateBackupConfig.and.returnValue(of(mockResponse));
      spyOn(window, 'alert');

      component.backupConfigForm.patchValue({
        autoBackupEnabled: true,
        backupIntervalDays: 14,
        retentionDays: 120
      });
      component.saveBackupConfig();

      expect(systemService.updateBackupConfig).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith('Configuración de backups actualizada correctamente');
    });

    it('should validate backup interval range', () => {
      component.backupConfigForm.patchValue({ backupIntervalDays: 0 });
      expect(component.backupConfigForm.get('backupIntervalDays')?.valid).toBeFalse();

      component.backupConfigForm.patchValue({ backupIntervalDays: 31 });
      expect(component.backupConfigForm.get('backupIntervalDays')?.valid).toBeFalse();

      component.backupConfigForm.patchValue({ backupIntervalDays: 7 });
      expect(component.backupConfigForm.get('backupIntervalDays')?.valid).toBeTrue();
    });
  });

  describe('Backup Management', () => {
    it('should load backup history successfully', () => {
      const mockBackups: BackupStatus[] = [
        {
          id: 'backup-1',
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
          size: 1024000
        }
      ];
      systemService.getBackupHistory.and.returnValue(of(mockBackups));

      component.loadBackupHistory();

      expect(component.loadingBackupHistory).toBeFalse();
      expect(component.backupHistory).toEqual(mockBackups);
      expect(component.backupHistory.length).toBe(1);
    });

    it('should trigger backup with confirmation', () => {
      const mockBackup: BackupStatus = {
        id: 'backup-123',
        status: 'pending',
        startedAt: new Date()
      };
      systemService.triggerBackup.and.returnValue(of(mockBackup));
      spyOn(window, 'confirm').and.returnValue(true);
      spyOn(window, 'alert');
      spyOn(component, 'monitorBackupStatus');

      component.triggerBackup();

      expect(window.confirm).toHaveBeenCalled();
      expect(systemService.triggerBackup).toHaveBeenCalled();
      expect(component.currentBackupStatus).toEqual(mockBackup);
      expect(component.monitorBackupStatus).toHaveBeenCalledWith('backup-123');
    });

    it('should not trigger backup if user cancels', () => {
      spyOn(window, 'confirm').and.returnValue(false);

      component.triggerBackup();

      expect(systemService.triggerBackup).not.toHaveBeenCalled();
    });

    it('should delete backup with confirmation', () => {
      systemService.deleteBackup.and.returnValue(of({ message: 'Deleted' }));
      spyOn(window, 'confirm').and.returnValue(true);
      spyOn(window, 'alert');
      spyOn(component, 'loadBackupHistory');

      component.deleteBackup('backup-123');

      expect(window.confirm).toHaveBeenCalled();
      expect(systemService.deleteBackup).toHaveBeenCalledWith('backup-123');
      expect(component.loadBackupHistory).toHaveBeenCalled();
    });

    it('should not delete backup if user cancels', () => {
      spyOn(window, 'confirm').and.returnValue(false);

      component.deleteBackup('backup-123');

      expect(systemService.deleteBackup).not.toHaveBeenCalled();
    });
  });

  describe('Utility Methods', () => {
    it('should format file size correctly', () => {
      expect(component.formatFileSize(0)).toBe('0 Bytes');
      expect(component.formatFileSize(1024)).toBe('1 KB');
      expect(component.formatFileSize(1048576)).toBe('1 MB');
      expect(component.formatFileSize(undefined)).toBe('N/A');
    });

    it('should format date correctly', () => {
      const testDate = new Date('2025-12-25');
      const result = component.formatDate(testDate);
      expect(result).toContain('25');
      expect(result).toContain('12');
      expect(result).toContain('2025');
    });

    it('should return correct backup status CSS class', () => {
      expect(component.getBackupStatusClass('completed')).toContain('green');
      expect(component.getBackupStatusClass('in_progress')).toContain('blue');
      expect(component.getBackupStatusClass('failed')).toContain('red');
      expect(component.getBackupStatusClass('pending')).toContain('yellow');
    });
  });

  describe('Form Validations', () => {
    it('should validate required fields', () => {
      expect(component.policiesForm.get('content')?.valid).toBeFalse();

      component.policiesForm.patchValue({ content: 'Some content' });
      expect(component.policiesForm.get('content')?.valid).toBeTrue();
    });

    it('should show validation errors on touched fields', () => {
      const control = component.policiesForm.get('content');
      expect(control?.hasError('required')).toBeTrue();
      expect(control?.touched).toBeFalse();

      control?.markAsTouched();
      expect(control?.touched).toBeTrue();
    });
  });
});
