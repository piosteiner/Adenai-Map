// admin-public/js/modules/characters/movements.js - Character Movements Module - Movement tracking and date handling

class CharacterMovements {
    constructor(auth, ui) {
        this.auth = auth;
        this.ui = ui;
        this.editingMovement = null;
        this.apiBaseUrl = '/api/characters';
    }

    // Render movement list with reordering controls (arrows and drag handle)
    renderMovementListWithReordering(movements, container, onReorder, sequenceMap = null) {
        // Clear container completely (no journey summary)
        container.innerHTML = '';
        
        // Ensure movements have movement_nr property
        movements = this.ensureMovementNumbers(movements);
        
        // Sort by movement_nr for display order
        const sorted = [...movements].sort((a, b) => a.movement_nr - b.movement_nr);
        
        sorted.forEach((movement, idx) => {
            // Use movement_nr for dynamic numbering that updates with reordering
            const journeyNumber = (movement.movement_nr ?? idx) + 1; // Start from 1, fallback to idx for safety
            const locationDisplay = movement.location || 'Custom Location';
            
            // Properly detect custom locations - only show badge if explicitly marked as custom
            const isCustom = movement.isCustomLocation === true;
            
            // Enhanced date range display
            const hasDateRange = movement.dateEnd && movement.dateEnd !== (movement.dateStart || movement.date);
            const dateDisplay = this.formatMovementDateRange(movement);
            const durationInfo = hasDateRange ? 
                this.calculateDuration(
                    new Date(movement.dateStart || movement.date), 
                    new Date(movement.dateEnd)
                ) : '';

            const movementEntry = document.createElement('div');
            movementEntry.className = 'movement-entry';
            movementEntry.setAttribute('data-movement-id', movement.id);
            movementEntry.setAttribute('data-movement-nr', movement.movement_nr);
            movementEntry.draggable = true;

            movementEntry.innerHTML = `
                <div class="movement-entry-header">
                    <div class="movement-reorder-controls">
                        <span class="drag-handle" title="Drag to reorder">☰</span>
                    </div>
                    <div class="movement-info">
                        <div class="movement-title">
                            <span class="journey-number">${journeyNumber}</span>
                            <h4>${locationDisplay}</h4>
                            ${isCustom ? '<span class="custom-location-badge">Custom</span>' : ''}
                            ${hasDateRange ? '<span class="date-range-badge">Multi-day</span>' : ''}
                        </div>
                        <div class="movement-date-container">
                            <span><strong>🎯 Type:</strong> ${movement.type || 'travel'}</span>
                            <span class="movement-date ${hasDateRange ? 'has-range' : ''}">${dateDisplay}</span>
                            ${durationInfo ? `<span class="movement-duration">${durationInfo}</span>` : ''}
                        </div>
                    </div>
                    <div class="movement-actions">
                        <button class="btn-secondary movement-edit-btn" data-movement="${movement.id}" title="Edit movement">✏️</button>
                        <button class="btn-danger movement-delete-btn" data-movement="${movement.id}" title="Delete movement">🗑️</button>
                    </div>
                </div>
                <div class="movement-details">
                    ${movement.notes ? `
                        <div class="movement-notes">
                            <strong>📋 Notes:</strong> 
                            <span class="notes-content collapsed" data-full-text="${movement.notes.replace(/"/g, '&quot;')}">${movement.notes}</span>
                            <button class="notes-toggle" title="Expand/Collapse notes">...</button>
                        </div>
                    ` : ''}
                </div>
            `;

            // Add expand/collapse functionality for notes
            const notesToggle = movementEntry.querySelector('.notes-toggle');
            if (notesToggle) {
                notesToggle.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent event bubbling
                    const notesContent = movementEntry.querySelector('.notes-content');
                    if (notesContent.classList.contains('collapsed')) {
                        notesContent.classList.remove('collapsed');
                        notesContent.classList.add('expanded');
                        notesToggle.textContent = '▲';
                        notesToggle.title = 'Collapse notes';
                    } else {
                        notesContent.classList.remove('expanded');
                        notesContent.classList.add('collapsed');
                        notesToggle.textContent = '...';
                        notesToggle.title = 'Expand notes';
                    }
                });
            }

            container.appendChild(movementEntry);
        });

        // Add drag-and-drop functionality
        this.setupDragAndDrop(container, movements, onReorder);
    }

    // Ensure movements have movement_nr property
    ensureMovementNumbers(movements) {
        return movements.map((movement, index) => {
            if (typeof movement.movement_nr === 'undefined') {
                movement.movement_nr = index;
                console.log(`🔢 Assigned movement_nr ${index} to movement ${movement.id}`);
            }
            return movement;
        });
    }

    // Setup drag and drop functionality
    setupDragAndDrop(container, movements, onReorder) {
        let dragSrc = null;
        
        container.querySelectorAll('.movement-entry').forEach(entry => {
            entry.ondragstart = (e) => {
                dragSrc = entry;
                entry.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            };
            
            entry.ondragend = () => {
                dragSrc = null;
                entry.classList.remove('dragging');
                container.querySelectorAll('.movement-entry').forEach(e => e.classList.remove('drag-over'));
            };
            
            entry.ondragover = (e) => {
                e.preventDefault();
                if (entry !== dragSrc) {
                    entry.classList.add('drag-over');
                }
            };
            
            entry.ondragleave = () => {
                entry.classList.remove('drag-over');
            };
            
            entry.ondrop = (e) => {
                e.preventDefault();
                entry.classList.remove('drag-over');
                
                if (dragSrc && dragSrc !== entry) {
                    const fromNr = parseInt(dragSrc.getAttribute('data-movement-nr'));
                    const toNr = parseInt(entry.getAttribute('data-movement-nr'));
                    this.reorderMovementsByDrag(movements, fromNr, toNr, onReorder);
                }
            };
        });
    }

    // Move movement up or down by delta (-1 or +1)
    moveMovement(movements, movementNr, delta, onReorder) {
        const idx = movements.findIndex(m => m.movement_nr === movementNr);
        if (idx < 0) return;
        const newIdx = idx + delta;
        if (newIdx < 0 || newIdx >= movements.length) return;
        // Swap
        [movements[idx], movements[newIdx]] = [movements[newIdx], movements[idx]];
        // Reassign movement_nr
        movements.forEach((m, i) => m.movement_nr = i);
        if (onReorder) onReorder(movements);
    }

    // Reorder movements by drag-and-drop
    reorderMovementsByDrag(movements, fromNr, toNr, onReorder) {
        const fromIdx = movements.findIndex(m => m.movement_nr === fromNr);
        const toIdx = movements.findIndex(m => m.movement_nr === toNr);
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
        const [moved] = movements.splice(fromIdx, 1);
        movements.splice(toIdx, 0, moved);
        // Reassign movement_nr
        movements.forEach((m, i) => m.movement_nr = i);
        if (onReorder) onReorder(movements);
    }

    async saveMovement(characterId, movementData, movementId = null) {
        if (!this.auth.requireAuth()) return null;

        // Validate movement data
        const validation = this.validateMovementData(movementData);
        if (!validation.isValid) {
            validation.errors.forEach(error => this.ui.showToast(error, 'error'));
            return null;
        }

        try {
            const isEditing = !!movementId;
            console.log(`🛤️ ${isEditing ? 'Updating' : 'Adding'} movement for character:`, characterId);
            
            const url = isEditing ? 
                `${this.apiBaseUrl}/${encodeURIComponent(characterId)}/movements/${encodeURIComponent(movementId)}` :
                `${this.apiBaseUrl}/${encodeURIComponent(characterId)}/movements`;
            
            const response = await this.auth.authenticatedFetch(url, {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(movementData)
            });

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast(`✅ Movement ${isEditing ? 'updated' : 'added'} successfully!`, 'success');
                
                // Update main map if it's loaded
                if (window.addCharacterMovementPaths) {
                    window.addCharacterMovementPaths();
                }
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'characters' } }));
                
                return result;
            } else {
                this.ui.showToast(`❌ Failed to ${isEditing ? 'update' : 'add'} movement`, 'error');
                return null;
            }
        } catch (error) {
            console.error('Movement save failed:', error);
            this.ui.showToast(`❌ Failed to ${movementId ? 'update' : 'add'} movement`, 'error');
            return null;
        }
    }

    async deleteMovement(characterId, movementId, movementDescription) {
        if (!this.auth.requireAuth()) return false;
        
        const confirmed = this.ui.confirm(
            `Are you sure you want to delete this movement?\n\n📍 ${movementDescription}\n\nThis action cannot be undone.`
        );
        
        if (!confirmed) return false;

        try {
            console.log('🗑️ Deleting movement:', movementId);
            
            const response = await this.auth.authenticatedFetch(
                `${this.apiBaseUrl}/${encodeURIComponent(characterId)}/movements/${encodeURIComponent(movementId)}`,
                { method: 'DELETE' }
            );

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast('✅ Movement deleted successfully!', 'success');
                
                // Update main map if it's loaded
                if (window.addCharacterMovementPaths) {
                    window.addCharacterMovementPaths();
                }
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'characters' } }));
                
                return true;
            } else {
                this.ui.showToast('❌ Failed to delete movement', 'error');
                return false;
            }
        } catch (error) {
            console.error('Delete failed:', error);
            this.ui.showToast('❌ Failed to delete movement', 'error');
            return false;
        }
    }

    validateMovementData(movementData) {
        const errors = [];
        
        // Date validation
        if (!movementData.dateStart) {
            errors.push('Start date is required');
        }
        
        if (movementData.dateStart && movementData.dateEnd) {
            const start = new Date(movementData.dateStart);
            const end = new Date(movementData.dateEnd);
            
            if (end < start) {
                errors.push('End date cannot be before start date');
            }
        }
        
        // Location validation based on type
        if (movementData.locationType === 'existing') {
            if (!movementData.location) {
                errors.push('Location is required');
            }
        } else {
            if (!movementData.location) {
                errors.push('Custom location name is required');
            }
            if (!movementData.coordinates || movementData.coordinates.length !== 2) {
                errors.push('Valid coordinates are required for custom locations');
            } else {
                // Check that both coordinates are valid numbers
                const [x, y] = movementData.coordinates;
                if (x === null || x === undefined || isNaN(Number(x)) || x === '') {
                    errors.push('X coordinate is required for custom locations');
                }
                if (y === null || y === undefined || isNaN(Number(y)) || y === '') {
                    errors.push('Y coordinate is required for custom locations');
                }
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Calculate duration between two dates
    calculateDuration(startDate, endDate) {
        const timeDiff = endDate.getTime() - startDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 0) {
            return 'Same day';
        } else if (daysDiff === 1) {
            return '1 day stay';
        } else if (daysDiff <= 7) {
            return `${daysDiff} days stay`;
        } else if (daysDiff <= 30) {
            const weeks = Math.ceil(daysDiff / 7);
            return weeks === 1 ? '1 week stay' : `${weeks} weeks stay`;
        } else {
            const months = Math.ceil(daysDiff / 30);
            return months === 1 ? '1 month stay' : `${months} months stay`;
        }
    }

    // Format movement date range for display
    formatMovementDateRange(movement) {
        const startDate = movement.dateStart || movement.date;
        const endDate = movement.dateEnd;
        
        if (!startDate) return 'No date';
        
        const formatDate = (dateStr) => {
            return new Date(dateStr).toLocaleDateString('de-DE');
        };
        
        if (endDate && endDate !== startDate) {
            return `📅 ${formatDate(startDate)} <span class="date-range-arrow">→</span> ${formatDate(endDate)}`;
        } else {
            return `📅 ${formatDate(startDate)}`;
        }
    }

    // Get unique locations from movements
    getUniqueLocations(movements) {
        const locations = new Set();
        movements.forEach(movement => {
            if (movement.coordinates && movement.coordinates.length === 2) {
                const locationKey = `${movement.coordinates[0]},${movement.coordinates[1]}`;
                locations.add(locationKey);
            }
        });
        return locations.size;
    }

    // Get date range span for movements
    getDateRange(movements) {
        if (movements.length === 0) return 'N/A';
        
        const dates = movements.map(m => new Date(m.dateStart || m.date)).sort((a, b) => a - b);
        const start = dates[0];
        const end = dates[dates.length - 1];
        
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 0) return 'Same day';
        if (daysDiff === 1) return '1 day';
        if (daysDiff < 30) return `${daysDiff} days`;
        if (daysDiff < 365) return `${Math.ceil(daysDiff / 30)} months`;
        return `${Math.ceil(daysDiff / 365)} years`;
    }

    // Generate path preview for movements
    generatePathPreview(chronologicalMovements) {
        if (chronologicalMovements.length === 0) return 'No movements';
        
        // Show first few locations in the journey
        const preview = chronologicalMovements
            .slice(0, 4)
            .map((movement, index) => {
                const name = movement.location || 'Custom';
                const shortName = name.length > 15 ? name.substring(0, 12) + '...' : name;
                return `<span class="path-step">${index + 1}. ${shortName}</span>`;
            })
            .join(' -> ');
        
        const remaining = chronologicalMovements.length - 4;
        const suffix = remaining > 0 ? ` → ... +${remaining} more` : '';
        
        return `<div class="path-preview">${preview}${suffix}</div>`;
    }

    // Create journey sequence map for proper ordering
    createSequenceMap(movements) {
        // Sort movements chronologically (oldest first) to get proper journey sequence
        const chronologicalMovements = [...movements].sort((a, b) => {
            const dateA = new Date(a.dateStart || a.date);
            const dateB = new Date(b.dateStart || b.date);
            return dateA - dateB;
        });
        
        // Create a map of movement ID to journey sequence number
        const sequenceMap = new Map();
        chronologicalMovements.forEach((movement, index) => {
            sequenceMap.set(movement.id, index + 1);
        });
        
        return { sequenceMap, chronologicalMovements };
    }

    // Sort movements by journey sequence (newest sequence first for display)
    sortMovementsForDisplay(movements) {
        const { sequenceMap } = this.createSequenceMap(movements);
        
        return [...movements].sort((a, b) => {
            const sequenceA = sequenceMap.get(a.id);
            const sequenceB = sequenceMap.get(b.id);
            return sequenceB - sequenceA; // Newest journey numbers first
        });
    }

    // Generate simplified journey summary without counters and path preview
    generateJourneySummary(chronologicalMovements) {
        return `
            <div class="journey-summary">
                <!-- Journey summary simplified - counters and path preview removed for condensed design -->
            </div>
        `;
    }

    // Date validation helpers
    showDateValidationError(message) {
        this.clearDateValidationMessages();
        
        const endDateGroup = document.getElementById('movement-date-end')?.parentElement;
        if (endDateGroup) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'date-validation-message';
            errorDiv.innerHTML = `⚠️ ${message}`;
            
            endDateGroup.appendChild(errorDiv);
            document.getElementById('movement-date-end')?.classList.add('error');
        }
    }

    // Update movement order in backend
    async updateMovementOrder(characterId, movements) {
        console.log('🔐 Checking authentication...');
        if (!this.auth.requireAuth()) {
            console.log('❌ Authentication check failed');
            return false;
        }
        console.log('✅ Authentication check passed');

        try {
            console.log('🔄 Updating movement order for character:', characterId);
            console.log('📋 Movements to reorder:', movements.map(m => ({ id: m.id, movement_nr: m.movement_nr })));
            
            const url = `${this.apiBaseUrl}/${encodeURIComponent(characterId)}/movements/reorder`;
            console.log('🌐 Making request to:', url);
            
            const response = await this.auth.authenticatedFetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movements: movements })
            });

            console.log('🌐 Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ HTTP Error:', response.status, errorText);
                this.ui.showToast(`❌ Failed to update movement order: HTTP ${response.status}`, 'error');
                return false;
            }
            
            const result = await response.json();
            console.log('📄 Response body:', result);
            
            if (result.success) {
                console.log('✅ Movement order updated successfully');
                
                // Update main map if it's loaded
                if (window.addCharacterMovementPaths) {
                    window.addCharacterMovementPaths();
                }
                
                // Notify stats update
                document.dispatchEvent(new CustomEvent('dataChanged', { detail: { type: 'characters' } }));
                
                return true;
            } else {
                console.error('❌ Backend rejected movement reorder:', result);
                this.ui.showToast(`❌ Failed to update movement order: ${result.error || 'Unknown error'}`, 'error');
                return false;
            }
        } catch (error) {
            console.error('❌ Movement reorder failed:', error);
            this.ui.showToast('❌ Failed to update movement order', 'error');
            return false;
        }
    }

    clearDateValidationMessages() {
        const errorMessages = document.querySelectorAll('.date-validation-message');
        errorMessages.forEach(msg => msg.remove());
        
        const errorInputs = document.querySelectorAll('input[type="date"].error');
        errorInputs.forEach(input => input.classList.remove('error'));
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterMovements;
}