// Daily Journal App - Main JavaScript
class DailyJournal {
  constructor() {
    this.currentDate = new Date();
    this.currentView = 'calendar';
    this.currentEntry = null;
    this.entries = new Map();
    this.selectedMood = null;
    this.currentPhotos = [];
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupTheme();
    await this.loadEntries();
    this.renderCalendar();
    this.showView('calendar');
  }

  setupEventListeners() {
    // Calendar navigation
    document.getElementById('prevMonth').addEventListener('click', () => this.navigateMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => this.navigateMonth(1));

    // View navigation
    document.getElementById('backToCalendar').addEventListener('click', () => this.showView('calendar'));
    document.getElementById('backToCalendarFromViewer').addEventListener('click', () => this.showView('calendar'));

    // Entry actions
    document.getElementById('saveEntry').addEventListener('click', () => this.saveEntry());
    document.getElementById('editEntry').addEventListener('click', () => this.editCurrentEntry());
    document.getElementById('deleteEntry').addEventListener('click', () => this.deleteCurrentEntry());

    // Search
    document.getElementById('searchBtn').addEventListener('click', () => this.toggleSearch());
    document.getElementById('clearSearch').addEventListener('click', () => this.closeSearch());
    document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e.target.value));

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

    // Formatting toolbar
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const command = btn.dataset.command;
        document.execCommand(command, false, null);
        this.updateFormatButtons();
      });
    });

    // Mood selection
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectMood(parseInt(btn.dataset.mood)));
    });

    // Photo upload
    document.getElementById('addPhotoBtn').addEventListener('click', () => {
      document.getElementById('photoInput').click();
    });
    
    document.getElementById('photoInput').addEventListener('change', (e) => {
      this.handlePhotoUpload(e.target.files);
    });

    // Word count
    document.getElementById('entryContent').addEventListener('input', () => this.updateWordCount());

    // Content editable focus handling
    document.getElementById('entryContent').addEventListener('focus', () => {
      this.updateFormatButtons();
    });

    document.getElementById('entryContent').addEventListener('keyup', () => {
      this.updateFormatButtons();
    });

    document.getElementById('entryContent').addEventListener('mouseup', () => {
      this.updateFormatButtons();
    });
  }

  setupTheme() {
    const savedTheme = localStorage.getItem('journal-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('journal-theme', newTheme);
    this.updateThemeIcon(newTheme);
  }

  updateThemeIcon(theme) {
    const icon = document.querySelector('#themeToggle i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }

  async loadEntries() {
    try {
      const response = await fetch('/api/entries');
      const entries = await response.json();
      
      this.entries.clear();
      entries.forEach(entry => {
        this.entries.set(entry.date, entry);
      });
    } catch (error) {
      console.error('Error loading entries:', error);
      this.showToast('Error loading entries', 'error');
    }
  }

  navigateMonth(direction) {
    this.currentDate.setMonth(this.currentDate.getMonth() + direction);
    this.renderCalendar();
  }

  renderCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    // Update month title
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    // Get previous month's last days
    const prevMonth = new Date(year, month, 0);
    const daysInPrevMonth = prevMonth.getDate();

    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';

    // Add previous month's trailing days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const dayElement = this.createDayElement(day, true, new Date(year, month - 1, day));
      calendarDays.appendChild(dayElement);
    }

    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const dayElement = this.createDayElement(day, false, new Date(year, month, day));
      calendarDays.appendChild(dayElement);
    }

    // Add next month's leading days
    const totalCells = calendarDays.children.length;
    const remainingCells = 42 - totalCells; // 6 rows × 7 days
    for (let day = 1; day <= remainingCells; day++) {
      const dayElement = this.createDayElement(day, true, new Date(year, month + 1, day));
      calendarDays.appendChild(dayElement);
    }
  }

  createDayElement(day, isOtherMonth, date) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    dayElement.textContent = day;

    if (isOtherMonth) {
      dayElement.classList.add('other-month');
    }

    // Check if it's today
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      dayElement.classList.add('today');
    }

    // Check if there's an entry for this date
    const dateString = this.formatDate(date);
    if (this.entries.has(dateString)) {
      dayElement.classList.add('has-entry');
    }

    // Add click handler
    dayElement.addEventListener('click', () => {
      // Check if we're in search mode and need to reload all entries first
      const searchInput = document.getElementById('searchInput');
      const isSearching = searchInput && searchInput.value.trim();
      
      if (isSearching) {
        // If searching, we need to check the full database for existing entries
        this.handleDateClickDuringSearch(dateString);
      } else {
        // Normal behavior when not searching
        if (this.entries.has(dateString)) {
          this.viewEntry(dateString);
        } else {
          this.createEntry(dateString);
        }
      }
    });

    return dayElement;
  }

  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  formatDisplayDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  createEntry(dateString) {
    this.currentEntry = {
      entryId: this.generateId(),
      date: dateString,
      title: '',
      content: '',
      mood: null,
      tags: [],
      attachments: { photos: [], audio: null },
      location: null,
      weather: null
    };

    document.getElementById('entryDate').textContent = this.formatDisplayDate(dateString);
    document.getElementById('entryTitle').value = '';
    document.getElementById('entryContent').innerHTML = '';
    document.getElementById('entryTags').value = '';
    
    this.currentPhotos = [];
    this.clearMoodSelection();
    this.renderPhotoPreview();
    this.updateWordCount();
    this.showView('editor');
  }

  viewEntry(dateString) {
    const entry = this.entries.get(dateString);
    if (!entry) return;

    this.currentEntry = entry;
    
    document.getElementById('viewerDate').textContent = this.formatDisplayDate(dateString);
    document.getElementById('viewerTitle').textContent = entry.title || 'Untitled Entry';
    document.getElementById('viewerContent').innerHTML = entry.content;
    
    // Display mood
    const moodDisplay = document.getElementById('viewerMood');
    if (entry.mood) {
      const moodEmojis = ['😢', '😔', '😐', '😊', '😄'];
      moodDisplay.innerHTML = `<strong>Mood:</strong> ${moodEmojis[entry.mood - 1]}`;
    } else {
      moodDisplay.innerHTML = '';
    }

    // Display tags
    const tagsDisplay = document.getElementById('viewerTags');
    if (entry.tags && entry.tags.length > 0) {
      tagsDisplay.innerHTML = entry.tags.map(tag => 
        `<span class="tag">${tag}</span>`
      ).join('');
    } else {
      tagsDisplay.innerHTML = '';
    }

    // Display photos
    this.renderViewerPhotos(entry.attachments.photos || []);

    this.showView('viewer');
  }

  editCurrentEntry() {
    if (!this.currentEntry) return;

    document.getElementById('entryDate').textContent = this.formatDisplayDate(this.currentEntry.date);
    document.getElementById('entryTitle').value = this.currentEntry.title || '';
    document.getElementById('entryContent').innerHTML = this.currentEntry.content || '';
    document.getElementById('entryTags').value = this.currentEntry.tags ? this.currentEntry.tags.join(', ') : '';
    
    if (this.currentEntry.mood) {
      this.selectMood(this.currentEntry.mood);
    } else {
      this.clearMoodSelection();
    }
    
    this.currentPhotos = [...(this.currentEntry.attachments.photos || [])];
    this.renderPhotoPreview();
    this.updateWordCount();
    this.showView('editor');
  }

  async saveEntry() {
    if (!this.currentEntry) return;

    const title = document.getElementById('entryTitle').value.trim();
    const content = document.getElementById('entryContent').innerHTML.trim();
    const tagsInput = document.getElementById('entryTags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

    if (!content) {
      this.showToast('Please write something before saving', 'error');
      return;
    }

    this.currentEntry.title = title;
    this.currentEntry.content = content;
    this.currentEntry.mood = this.selectedMood;
    this.currentEntry.tags = tags;
    this.currentEntry.attachments.photos = [...this.currentPhotos];

    try {
      this.showLoading(true);
      
      const response = await fetch('/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.currentEntry)
      });

      if (response.ok) {
        this.entries.set(this.currentEntry.date, { ...this.currentEntry });
        this.showToast('Entry saved successfully', 'success');
        this.renderCalendar();
        this.showView('calendar');
      } else {
        throw new Error('Failed to save entry');
      }
    } catch (error) {
      console.error('Error saving entry:', error);
      this.showToast('Error saving entry', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async deleteCurrentEntry() {
    if (!this.currentEntry || !confirm('Are you sure you want to delete this entry?')) return;

    try {
      this.showLoading(true);
      
      const response = await fetch(`/api/entries/${this.currentEntry.entryId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        this.entries.delete(this.currentEntry.date);
        this.showToast('Entry deleted successfully', 'success');
        this.renderCalendar();
        this.showView('calendar');
      } else {
        throw new Error('Failed to delete entry');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      this.showToast('Error deleting entry', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  selectMood(mood) {
    this.selectedMood = mood;
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.classList.toggle('selected', parseInt(btn.dataset.mood) === mood);
    });
  }

  clearMoodSelection() {
    this.selectedMood = null;
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.classList.remove('selected');
    });
  }

  updateWordCount() {
    const content = document.getElementById('entryContent').textContent || '';
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    document.getElementById('wordCount').textContent = `${words} word${words !== 1 ? 's' : ''}`;
  }

  updateFormatButtons() {
    document.querySelectorAll('.format-btn').forEach(btn => {
      const command = btn.dataset.command;
      const isActive = document.queryCommandState(command);
      btn.classList.toggle('active', isActive);
    });
  }

  toggleSearch() {
    const searchContainer = document.getElementById('searchContainer');
    const isHidden = searchContainer.classList.contains('hidden');
    
    if (isHidden) {
      searchContainer.classList.remove('hidden');
      document.getElementById('searchInput').focus();
    } else {
      this.closeSearch();
    }
  }

  async closeSearch() {
    const searchContainer = document.getElementById('searchContainer');
    searchContainer.classList.add('hidden');
    document.getElementById('searchInput').value = '';
    await this.loadEntries(); // Reload all entries from database
    this.renderCalendar();
  }

  async clearSearch() {
    document.getElementById('searchInput').value = '';
    await this.loadEntries(); // Reload all entries from database
    this.renderCalendar();
  }

  async handleSearch(query) {
    if (!query.trim()) {
      await this.loadEntries(); // Reload all entries when search is cleared
      this.renderCalendar();
      return;
    }

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const results = await response.json();
      
      // Update entries map with search results
      this.entries.clear();
      results.forEach(entry => {
        this.entries.set(entry.date, entry);
      });
      
      this.renderCalendar();
    } catch (error) {
      console.error('Error searching entries:', error);
      this.showToast('Error searching entries', 'error');
    }
  }

  showView(view) {
    const views = ['calendar', 'editor', 'viewer'];
    views.forEach(v => {
      const element = document.getElementById(`${v}View` === 'calendarView' ? 'calendarView' : 
                                           v === 'editor' ? 'entryEditor' : 'entryViewer');
      if (element) {
        element.classList.toggle('hidden', v !== view);
      }
    });
    this.currentView = view;
  }

  showLoading(show) {
    document.getElementById('loadingSpinner').classList.toggle('hidden', !show);
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  async handlePhotoUpload(files) {
    if (!files || files.length === 0) return;

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        this.showToast('Please select only image files (JPEG, PNG, GIF, etc.)', 'error');
        continue;
      }

      const maxSize = 10 * 1024 * 1024; // 10MB limit (matches server limit)
      if (file.size > maxSize) {
        this.showToast(`Image size must be less than ${maxSize / (1024 * 1024)}MB`, 'error');
        continue;
      }

      try {
        this.showLoading(true);
        
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Upload failed');
        }

        // Store the full URL to the uploaded file
        const photoUrl = result.path.startsWith('http') ? result.path : 
                        (result.path.startsWith('/') ? result.path : `/${result.path}`);
        
        this.currentPhotos.push(photoUrl);
        this.renderPhotoPreview();
        this.showToast('Photo uploaded successfully!', 'success');
        
      } catch (error) {
        console.error('Error uploading photo:', error);
        const errorMessage = error.message || 'Error uploading photo. Please try again.';
        this.showToast(errorMessage, 'error');
      } finally {
        this.showLoading(false);
        // Clear the input so the same file can be selected again
        document.getElementById('photoInput').value = '';
      }
    }
  }

  renderPhotoPreview() {
    const previewContainer = document.getElementById('photoPreview');
    previewContainer.innerHTML = '';

    this.currentPhotos.forEach((photoPath, index) => {
      const photoItem = document.createElement('div');
      photoItem.className = 'photo-item';
      
      photoItem.innerHTML = `
        <img src="${photoPath}" alt="Photo ${index + 1}" loading="lazy">
        <button class="remove-photo" data-index="${index}" title="Remove photo">
          <i class="fas fa-times"></i>
        </button>
      `;

      // Add remove functionality
      photoItem.querySelector('.remove-photo').addEventListener('click', () => {
        this.removePhoto(index);
      });

      previewContainer.appendChild(photoItem);
    });
  }

  removePhoto(index) {
    this.currentPhotos.splice(index, 1);
    this.renderPhotoPreview();
  }

  renderViewerPhotos(photos) {
    const photosContainer = document.getElementById('viewerPhotos');
    
    if (!photos || photos.length === 0) {
      photosContainer.innerHTML = '';
      return;
    }

    const photoGrid = document.createElement('div');
    photoGrid.className = 'viewer-photo-grid';

    photos.forEach((photoPath, index) => {
      const photoItem = document.createElement('div');
      photoItem.className = 'viewer-photo-item';
      
      photoItem.innerHTML = `
        <img src="${photoPath}" alt="Photo ${index + 1}" loading="lazy">
      `;

      // Add click to view full size
      photoItem.addEventListener('click', () => {
        this.showPhotoModal(photoPath);
      });

      photoGrid.appendChild(photoItem);
    });

    photosContainer.innerHTML = '';
    photosContainer.appendChild(photoGrid);
  }

  showPhotoModal(photoPath) {
    const modal = document.createElement('div');
    modal.className = 'photo-modal';
    
    modal.innerHTML = `
      <img src="${photoPath}" alt="Full size photo">
      <button class="close-modal">
        <i class="fas fa-times"></i>
      </button>
    `;

    // Close modal functionality
    const closeModal = () => {
      modal.remove();
      document.removeEventListener('keydown', handleKeydown);
    };

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    modal.querySelector('.close-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', handleKeydown);
    document.body.appendChild(modal);
  }

  async handleDateClickDuringSearch(dateString) {
    try {
      // Check if entry exists in database by fetching it
      const response = await fetch(`/api/entries/${dateString}`);
      
      if (response.ok) {
        // Entry exists, view it
        const entry = await response.json();
        this.entries.set(dateString, entry); // Update local cache
        this.viewEntry(dateString);
      } else if (response.status === 404) {
        // Entry doesn't exist, create new one
        this.createEntry(dateString);
      } else {
        throw new Error('Failed to check entry');
      }
    } catch (error) {
      console.error('Error checking entry during search:', error);
      // Fallback to local cache behavior
      if (this.entries.has(dateString)) {
        this.viewEntry(dateString);
      } else {
        this.createEntry(dateString);
      }
    }
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new DailyJournal();
});
