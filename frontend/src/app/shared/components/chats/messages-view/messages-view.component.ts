import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IMessage } from '../../../../core/services/message.service';

@Component({
  selector: 'app-messages-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './messages-view.component.html',
  styleUrls: ['./messages-view.component.scss']
})
export class MessagesViewComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() messages: IMessage[] = [];
  @Input() currentUserId: string | number | null = null;
  @Input() loadingMessages = false;
  @Input() hasMoreMessages = true;
  @Input() maxHeight: number | null = 560;

  @Output() loadOlder = new EventEmitter<void>();

  @ViewChild('messagesScrollRef') private messagesScrollRef?: ElementRef<HTMLElement>;

  public mediaViewerOpen = false;
  public mediaViewerUrl: string | null = null;
  public mediaViewerType: 'image' | 'video' | 'audio' | null = null;

  private _boundEscHandler = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' || ev.key === 'Esc') this.closeMediaViewer();
  };

  private _mediaListeners: Array<{ el: Element; type: string; handler: EventListenerOrEventListenerObject }> = [];

  private _pendingPrepend: { scrollTop: number; scrollHeight: number } | null = null;

  ngAfterViewInit(): void {
    setTimeout(() => {
      try { this.bindMediaLoadHandlers(); } catch (e) {}
      try { this.scrollToBottom(); } catch (e) {}
    }, 20);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages']) {
      setTimeout(() => {
        try { this.bindMediaLoadHandlers(); } catch (e) {}
        const el = this.messagesScrollRef?.nativeElement;
        if (this._pendingPrepend && el) {
          const pending = this._pendingPrepend;
          const newScrollHeight = el.scrollHeight;
          const delta = newScrollHeight - pending.scrollHeight;
          try { el.scrollTop = Math.max(0, Math.round(pending.scrollTop + delta)); } catch(e) {}
          // if there are no media elements that can change layout further, clear pending now
          const mediaCount = el.querySelectorAll('img,video').length;
          if (mediaCount === 0) {
            this._pendingPrepend = null;
          }
        } else {
          try { this.scrollToBottom(); } catch (e) {}
        }
      }, 30);
    }
  }

  ngOnDestroy(): void {
    this.clearMediaLoadHandlers();
    try { window.removeEventListener('keydown', this._boundEscHandler); } catch (e) {}
  }

  isOwnMessage(m: IMessage): boolean {
    if (!m || !m.user) return false;
    const uid = String(this.currentUserId ?? '');
    const mid = String(m.user.id ?? '');
    return uid !== '' && uid === mid;
  }

  onScroll(e: any): void {
    const el = e.target as HTMLElement;
    if (!el) return;
    if (el.scrollTop < 120) {
      if (this.hasMoreMessages) {
        this._pendingPrepend = { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight };
        this.loadOlder.emit();
      }
    }
  }

  public scrollToBottom(): void {
    const el = this.messagesScrollRef?.nativeElement;
    if (!el) return;
    try {
      const last = el.querySelector('.msg-row:last-child') as HTMLElement | null;
      const doScroll = () => {
        try {
          if (last && last.scrollIntoView) {
            last.scrollIntoView({ block: 'end', behavior: 'auto' });
          } else {
            el.scrollTop = el.scrollHeight;
          }
        } catch (e) {}
      };
      requestAnimationFrame(() => {
        doScroll();
        setTimeout(() => doScroll(), 60);
      });
    } catch (e) {
    }
  }

  public openMediaViewer(url: string | null | undefined, type: 'image' | 'video' | 'audio' | null = 'image'){
    if (!url) return;
    this.mediaViewerUrl = String(url);
    this.mediaViewerType = type;
    this.mediaViewerOpen = true;
    try { window.addEventListener('keydown', this._boundEscHandler); } catch (e) {}
  }

  public closeMediaViewer(){
    this.mediaViewerOpen = false;
    this.mediaViewerUrl = null;
    this.mediaViewerType = null;
    try { window.removeEventListener('keydown', this._boundEscHandler); } catch (e) {}
  }

  getMediaList(m: any): string[] {
    if (!m) return [];
    if (Array.isArray(m.files) && m.files.length) {
      return m.files.map((f: any) => {
        if (!f) return '';
        if (typeof f === 'string') return f;
        return f.url ?? f.path ?? f.fileUrl ?? f.name ?? '';
      }).filter((u: string) => !!u);
    }
    if (Array.isArray(m.message) && m.message.length) return m.message.filter((u: any) => !!u).map((u: any) => String(u));
    if (typeof m.message === 'string' && m.message.trim()) return [m.message.trim()];
    return [];
  }

  isMediaMultiple(m: any): boolean {
    const list = this.getMediaList(m);
    return list.length > 1;
  }

  bindMediaLoadHandlers(): void {
    const container = this.messagesScrollRef?.nativeElement;
    if (!container) return;
    this.clearMediaLoadHandlers();
    try {
      const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
      const videos = Array.from(container.querySelectorAll('video')) as HTMLVideoElement[];
      const add = (el: Element, type: string, handler: EventListener) => {
        el.addEventListener(type, handler);
        this._mediaListeners.push({ el, type, handler });
      };
      imgs.forEach(img => {
        if (img.complete && img.naturalHeight !== 0) return;
        const h = () => {
          setTimeout(() => {
            try {
              const el2 = this.messagesScrollRef?.nativeElement;
              if (this._pendingPrepend && el2) {
                const pending = this._pendingPrepend;
                const delta2 = el2.scrollHeight - pending.scrollHeight;
                try { el2.scrollTop = Math.max(0, Math.round(pending.scrollTop + delta2)); } catch(e) {}

                this._pendingPrepend = null;
              } else {
                this.scrollToBottom();
              }
            } catch (e) {}
          }, 40);
          try { img.removeEventListener('load', h); } catch(e){}
        };
        add(img, 'load', h);
        const eh = () => {
          setTimeout(() => {
            try {
              if (this._pendingPrepend) {
                const el2 = this.messagesScrollRef?.nativeElement;
                if (el2 && this._pendingPrepend) {
                  const pending = this._pendingPrepend;
                  const delta2 = el2.scrollHeight - pending.scrollHeight;
                  try { el2.scrollTop = Math.max(0, Math.round(pending.scrollTop + delta2)); } catch(e) {}
                }
                this._pendingPrepend = null;
              } else {
                this.scrollToBottom();
              }
            } catch(e) {}
          }, 40);
          try { img.removeEventListener('error', eh); } catch(e){}
        };
        add(img, 'error', eh);
      });
      videos.forEach(video => {
        const onMediaReady = () => {
          setTimeout(() => {
            try {
              const el2 = this.messagesScrollRef?.nativeElement;
              if (this._pendingPrepend && el2) {
                const pending = this._pendingPrepend;
                const delta2 = el2.scrollHeight - pending.scrollHeight;
                try { el2.scrollTop = Math.max(0, Math.round(pending.scrollTop + delta2)); } catch(e) {}
                this._pendingPrepend = null;
              } else {
                this.scrollToBottom();
              }
            } catch (e) {}
          }, 80);
          try { video.removeEventListener('loadeddata', onMediaReady); } catch (e) {}
        };
        add(video, 'loadeddata', onMediaReady);
        const onMeta = () => {
          setTimeout(() => {
            try {
              const el2 = this.messagesScrollRef?.nativeElement;
              if (this._pendingPrepend && el2) {
                const pending = this._pendingPrepend;
                const delta2 = el2.scrollHeight - pending.scrollHeight;
                try { el2.scrollTop = Math.max(0, Math.round(pending.scrollTop + delta2)); } catch(e) {}
                this._pendingPrepend = null;
              } else {
                this.scrollToBottom();
              }
            } catch (e) {}
          }, 80);
          try { video.removeEventListener('loadedmetadata', onMeta); } catch (e) {}
        };
        add(video, 'loadedmetadata', onMeta);
        const eh = () => {
          setTimeout(() => {
            try {
              if (this._pendingPrepend) {
                const el2 = this.messagesScrollRef?.nativeElement;
                if (el2 && this._pendingPrepend) {
                  const pending = this._pendingPrepend;
                  const delta2 = el2.scrollHeight - pending.scrollHeight;
                  try { el2.scrollTop = Math.max(0, Math.round(pending.scrollTop + delta2)); } catch(e) {}
                }
                this._pendingPrepend = null;
              } else {
                this.scrollToBottom();
              }
            } catch(e) {}
          }, 80);
          try { video.removeEventListener('error', eh); } catch(e) {}
        };
        add(video, 'error', eh);
      });
    } catch (err) {
    }
  }

  clearMediaLoadHandlers(): void {
    try {
      this._mediaListeners.forEach(l => {
        try { l.el.removeEventListener(l.type, l.handler); } catch (e) {}
      });
    } finally {
      this._mediaListeners = [];
    }
  }

  formatMessageTime(dateInput: string | Date | undefined | null): string {
    if (!dateInput) return '';
    const d = new Date(dateInput as any);
    if (isNaN(d.getTime())) return '';
    const now = new Date();

    const isSameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate();

    const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });

    if (isSameDay) return `Hoy a las ${timeStr}`;
    if (isYesterday) return `Ayer a las ${timeStr}`;

    const sameYear = d.getFullYear() === now.getFullYear();
    const dayMonth = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(d).replace('.', '');
    if (sameYear) {
      return `${dayMonth} a las ${timeStr}`;
    }
    const dayMonthYear = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(d).replace('.', '');
    return `${dayMonthYear} a las ${timeStr}`;
  }
}
