import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ProfileTab = 'posts' | 'donations' | 'stats' | 'location';

@Component({
  selector: 'app-profile-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-tabs.component.html',
  styleUrls: ['./profile-tabs.component.scss']
})
export class ProfileTabsComponent {
  @Input() activeTab: ProfileTab = 'posts';
  @Input() showLocation = true;
  @Output() tabChange = new EventEmitter<ProfileTab>();
  get tabs() {
    const list = [
      { id: 'posts' as ProfileTab, label: 'Publicaciones', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z', enabled: true },
      { id: 'donations' as ProfileTab, label: 'Donaciones', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', enabled: true },
      { id: 'stats' as ProfileTab, label: 'Estadísticas', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', enabled: true }
    ];

    if (this.showLocation) {
      list.push({ id: 'location' as ProfileTab, label: 'Ubicación', icon: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z', enabled: true });
    }

    return list;
  }

  selectTab(tabId: ProfileTab): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab?.enabled) {
      this.activeTab = tabId;
      this.tabChange.emit(tabId);
    }
  }
}
