// admin-public/js/modules/journeys/segments.js - Journey Segments Module - Segment management and rendering

class JourneySegments {
    constructor(ui) {
        this.ui = ui;
        this.editingSegment = null;
        this.debugMode = true;
    }

    renderSegmentList(journey) {
        const listContainer = document.getElementById('segments-list');
        if (!listContainer) return;
        
        if (!journey || !journey.segments || !journey.segments.length) {
            listContainer.innerHTML = '<p class="no-segments">No segments yet. Click "Add Segment" to start building the route.</p>';
            return;
        }

        listContainer.innerHTML = journey.segments.map((segment, index) => 
            this.renderSegmentCard(segment, index)
        ).join('');

        // Add event listeners
        this.addSegmentEventListeners();
    }

    renderSegmentCard(segment, index) {
        const isCustomLocation = segment.isCustomLocation || 
            (segment.coordinates && segment.location !== segment.coordinates);
        
        return `
            <div class="segment-item" data-segment-index="${index}">
                <div class="segment-header">
                    <div class="segment-info">
                        <div class="segment-title">
                            <span class="segment-number">${index + 1}</span>
                            <h4>${this.escapeHtml(segment.description) || 'Segment ' + (index + 1)}</h4>
                            ${isCustomLocation ? '<span class="custom-segment-badge">Custom</span>' : ''}
                        </div>
                        <div class="segment-meta">
                            <span class="segment-type">${segment.type || 'L'}</span>
                            <span class="segment-coords">[${segment.coords[0]}, ${segment.coords[1]}]</span>
                        </div>
                    </div>
                    <div class="segment-actions">
                        <button class="btn-secondary btn-small segment-edit-btn" 
                                data-segment-index="${index}" title="Edit segment">
                            ✏️
                        </button>
                        <button class="btn-danger btn-small segment-delete-btn" 
                                data-segment-index="${index}" title="Delete segment">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="segment-details">
                    ${segment.control ? `<div class="segment-control">Control: [${segment.control[0]}, ${segment.control[1]}]</div>` : ''}
                    ${segment.notes ? `<div class="segment-notes">${this.escapeHtml(segment.notes)}</div>` : ''}
                </div>
            </div>
        `;
    }

    addSegmentEventListeners() {
        // Edit segment buttons
        document.querySelectorAll('.segment-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const segmentIndex = parseInt(e.target.dataset.segmentIndex);
                this.editSegment(segmentIndex);
            });
        });
        
        // Delete segment buttons
        document.querySelectorAll('.segment-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const segmentIndex = parseInt(e.target.dataset.segmentIndex);
                this.requestDeleteSegment(segmentIndex);
            });
        });
    }

    editSegment(segmentIndex) {
        // This would be implemented to open an edit modal/form
        this.log(`Edit segment ${segmentIndex}`);
        // Could emit event or call callback
        document.dispatchEvent(new CustomEvent('segmentEdit', { 
            detail: { segmentIndex } 
        }));
    }

    requestDeleteSegment(segmentIndex) {
        if (this.ui.confirm('Delete this segment?')) {
            this.log(`Delete segment ${segmentIndex}`);
            // Could emit event or call callback
            document.dispatchEvent(new CustomEvent('segmentDelete', { 
                detail: { segmentIndex } 
            }));
        }
    }

    createSegmentFromPoints(tempSegments, description = '') {
        if (!tempSegments || tempSegments.length === 0) {
            throw new Error('No points provided for segment creation');
        }

        const segmentType = tempSegments.length === 1 ? 'L' : 'Q';
        const coords = tempSegments[0].coords;
        const control = tempSegments.length > 1 ? tempSegments[1].coords : null;
        
        return {
            type: segmentType,
            coords: coords,
            control: control,
            description: description || `Segment at [${coords[0]}, ${coords[1]}]`,
            notes: '',
            isCustomLocation: true,
            createdAt: new Date().toISOString()
        };
    }

    validateSegmentData(segmentData) {
        const errors = [];
        
        if (!segmentData.coords || !Array.isArray(segmentData.coords) || segmentData.coords.length !== 2) {
            errors.push('Valid coordinates are required');
        }
        
        if (segmentData.coords) {
            const [x, y] = segmentData.coords;
            if (typeof x !== 'number' || typeof y !== 'number') {
                errors.push('Coordinates must be numbers');
            }
            if (x < 0 || y < 0 || x > 2048 || y > 1536) {
                errors.push('Coordinates must be within map bounds (0-2048, 0-1536)');
            }
        }
        
        if (segmentData.type && !['L', 'Q', 'C'].includes(segmentData.type)) {
            errors.push('Invalid segment type - must be L (line), Q (quadratic), or C (cubic)');
        }
        
        if (segmentData.type === 'Q' && (!segmentData.control || 
            !Array.isArray(segmentData.control) || segmentData.control.length !== 2)) {
            errors.push('Quadratic segments require valid control points');
        }
        
        if (segmentData.description && segmentData.description.length > 200) {
            errors.push('Description must be less than 200 characters');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    calculateSegmentDistance(segment) {
        if (!segment.coords || segment.coords.length !== 2) {
            return 0;
        }
        
        // For linear segments, this would be distance from previous point
        // For now, just return coordinate magnitude as rough distance
        const [x, y] = segment.coords;
        return Math.sqrt(x * x + y * y);
    }

    getSegmentStats(segments) {
        if (!segments || !Array.isArray(segments)) {
            return {
                total: 0,
                linear: 0,
                quadratic: 0,
                cubic: 0,
                totalDistance: 0,
                avgDistance: 0
            };
        }
        
        const stats = {
            total: segments.length,
            linear: 0,
            quadratic: 0,
            cubic: 0,
            totalDistance: 0,
            avgDistance: 0
        };
        
        segments.forEach(segment => {
            switch (segment.type) {
                case 'L':
                    stats.linear++;
                    break;
                case 'Q':
                    stats.quadratic++;
                    break;
                case 'C':
                    stats.cubic++;
                    break;
            }
            
            stats.totalDistance += this.calculateSegmentDistance(segment);
        });
        
        stats.avgDistance = stats.total > 0 ? stats.totalDistance / stats.total : 0;
        
        return stats;
    }

    renderSegmentStats(segments) {
        const stats = this.getSegmentStats(segments);
        
        return `
            <div class="segment-stats">
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-number">${stats.total}</span>
                        <span class="stat-label">Total Segments</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${stats.linear}</span>
                        <span class="stat-label">Linear</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${stats.quadratic}</span>
                        <span class="stat-label">Curved</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${Math.round(stats.avgDistance)}</span>
                        <span class="stat-label">Avg Distance</span>
                    </div>
                </div>
            </div>
        `;
    }

    populateSegmentForm(segment = null, segmentIndex = null) {
        const form = document.getElementById('segment-form');
        if (!form) return;
        
        const isEditing = segment && segmentIndex !== null;
        
        // Update form title
        const formTitle = document.querySelector('#segment-form .form-title');
        if (formTitle) {
            formTitle.textContent = isEditing ? 
                `Edit Segment ${segmentIndex + 1}` : 'Add New Segment';
        }
        
        if (segment) {
            // Populate with existing segment data
            this.ui.populateForm('segment-form', {
                segmentType: segment.type || 'L',
                segmentX: segment.coords ? segment.coords[0] : '',
                segmentY: segment.coords ? segment.coords[1] : '',
                segmentControlX: segment.control ? segment.control[0] : '',
                segmentControlY: segment.control ? segment.control[1] : '',
                segmentDescription: segment.description || '',
                segmentNotes: segment.notes || ''
            });
            
            // Show/hide control inputs based on type
            this.toggleControlInputs(segment.type === 'Q' || segment.type === 'C');
        } else {
            // Reset form for new segment
            this.ui.resetForm('segment-form');
            this.toggleControlInputs(false);
        }
        
        this.editingSegment = isEditing ? segmentIndex : null;
    }

    toggleControlInputs(show) {
        const controlInputs = document.getElementById('segment-control-inputs');
        if (controlInputs) {
            controlInputs.style.display = show ? 'block' : 'none';
        }
    }

    getSegmentFormData() {
        const formData = this.ui.getFormData('segment-form');
        if (!formData) return null;
        
        const segmentData = {
            type: formData.segmentType || 'L',
            coords: [
                parseInt(formData.segmentX) || 0,
                parseInt(formData.segmentY) || 0
            ],
            description: formData.segmentDescription || '',
            notes: formData.segmentNotes || ''
        };
        
        // Add control points for quadratic/cubic segments
        if (segmentData.type === 'Q' || segmentData.type === 'C') {
            if (formData.segmentControlX && formData.segmentControlY) {
                segmentData.control = [
                    parseInt(formData.segmentControlX),
                    parseInt(formData.segmentControlY)
                ];
            }
        }
        
        return segmentData;
    }

    // Segment ordering and path optimization
    optimizeSegmentOrder(segments) {
        if (!segments || segments.length <= 2) return segments;
        
        // Simple optimization: sort by distance from origin
        return [...segments].sort((a, b) => {
            const distA = this.calculateSegmentDistance(a);
            const distB = this.calculateSegmentDistance(b);
            return distA - distB;
        });
    }

    // Convert segments to path data for map rendering
    segmentsToPathData(segments) {
        if (!segments || !Array.isArray(segments)) return [];
        
        return segments
            .filter(segment => segment.coords && segment.coords.length === 2)
            .map(segment => [segment.coords[0], segment.coords[1]]);
    }

    // Export segment data
    exportSegments(segments, journeyName) {
        const data = {
            journey: journeyName,
            segments: segments,
            stats: this.getSegmentStats(segments),
            exported: new Date().toISOString()
        };
        
        this.ui.exportJson(data, `${journeyName}-segments`);
    }

    // Utility functions
    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    log(...args) {
        if (this.debugMode) {
            console.log('[JourneySegments]', ...args);
        }
    }

    // Debug utility
    getDebugInfo() {
        return {
            editingSegment: this.editingSegment,
            hasSegmentForm: !!document.getElementById('segment-form'),
            hasSegmentsList: !!document.getElementById('segments-list')
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JourneySegments;
}