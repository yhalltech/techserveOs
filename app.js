// TechServe OS Installation Application
// Main JavaScript file that connects to server API

// API Configuration
const API_BASE_URL = '/api';

// Generate random order number (max 20 chars for database)
function generateOrderNumber() {
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    const random = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit random
    return `TS-${timestamp}${random}`; // Format: TS-123456789 (12 chars total)
}

// Application state
const appState = {
    currentStep: 1,
    installationType: null,
    selectedOS: [],
    selectedVersions: [],
    customerInfo: {},
    addOns: {},
    orderNumber: generateOrderNumber(),
    pricing: {},
    osData: [],
    isLoading: false
};

// API Helper Functions
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include'
    };

    try {
        showLoading();
        console.log('Making API call to:', url);
        const response = await fetch(url, { ...defaultOptions, ...options });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (!response.ok) {
            console.error('API request failed:', data);
            throw new Error(data.error || `API request failed with status ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        // Don't show alert here - let the calling function handle it
        throw error;
    } finally {
        hideLoading();
    }
}

// Loading functions
function showLoading() {
    document.getElementById('loading-spinner').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-spinner').classList.add('hidden');
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    setupAdminActivation();
    updateProgressIndicator();
});

// Initialize the application
async function initializeApp() {
    try {
        // Set order number
        document.getElementById('order-number').textContent = appState.orderNumber;
        
        // Hide all components except the first one
        document.querySelectorAll('.component').forEach((component, index) => {
            if (index === 0) {
                component.classList.remove('hidden');
            } else {
                component.classList.add('hidden');
            }
        });
        
        // Load data from server
        await Promise.all([
            loadOSData(),
            loadPricing()
        ]);
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        alert('Failed to load application data. Please refresh the page.');
    }
}

// Load OS data from server
async function loadOSData() {
    try {
        const osData = await apiCall('/operating-systems');
        appState.osData = osData;
        populateOSOptions(osData);
        console.log('OS data loaded:', osData);
    } catch (error) {
        console.error('Error loading OS data:', error);
    }
}

// Load pricing from server
async function loadPricing() {
    try {
        // For now, use default pricing since we don't have a public pricing endpoint
        appState.pricing = {
            full_installation: 100,
            dual_boot_installation: 150,
            additional_drivers: 30,
            office_suite: 50
        };
        
        updatePricingDisplay();
        console.log('Pricing loaded');
    } catch (error) {
        console.error('Error loading pricing:', error);
    }
}

// Update pricing display
function updatePricingDisplay() {
    document.getElementById('full-installation-price').textContent = `KSh ${appState.pricing.full_installation}`;
    document.getElementById('dual-boot-price').textContent = `KSh ${appState.pricing.dual_boot_installation}`;
    document.getElementById('drivers-price').textContent = `+KSh ${appState.pricing.additional_drivers}`;
    document.getElementById('office-price').textContent = `+KSh ${appState.pricing.office_suite}`;
    
    // Update pricing info section
    const pricingInfo = document.getElementById('pricing-info');
    pricingInfo.innerHTML = `
        <div class="bg-blue-50 p-4 rounded-lg">
            <div class="flex justify-between items-center mb-2">
                <h3 class="font-semibold">Full Installation</h3>
                <span class="text-blue-600 font-bold">KSh ${appState.pricing.full_installation}</span>
            </div>
            <p class="text-sm text-gray-600">Includes installation of a single OS with basic configuration</p>
        </div>
        <div class="bg-green-50 p-4 rounded-lg">
            <div class="flex justify-between items-center mb-2">
                <h3 class="font-semibold">Dual Boot Installation</h3>
                <span class="text-green-600 font-bold">KSh ${appState.pricing.dual_boot_installation}</span>
            </div>
            <p class="text-sm text-gray-600">Includes installation of two OSes with boot manager configuration</p>
        </div>
    `;
}

// Set up event listeners
function setupEventListeners() {
    // Navigation buttons
    document.getElementById('help-btn').addEventListener('click', () => toggleModal('help-modal'));
    document.getElementById('terms-btn').addEventListener('click', () => toggleModal('terms-modal'));
    document.getElementById('about-btn').addEventListener('click', () => toggleModal('about-modal'));
    document.getElementById('login-btn').addEventListener('click', showLoginView);
    
    // Modal close buttons
    document.getElementById('close-terms').addEventListener('click', () => toggleModal('terms-modal'));
    document.getElementById('close-help').addEventListener('click', () => toggleModal('help-modal'));
    document.getElementById('close-about').addEventListener('click', () => toggleModal('about-modal'));
    
    // Installation type selection
    document.querySelectorAll('.install-type').forEach(type => {
        type.addEventListener('click', () => selectInstallationType(type.dataset.type));
    });
    
    // Back and continue buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', goToPreviousStep);
    });
    
    document.querySelectorAll('.continue-btn').forEach(btn => {
        btn.addEventListener('click', goToNextStep);
    });
    
    // Dual OS selection
    document.getElementById('dual-os-1').addEventListener('change', validateDualSelection);
    document.getElementById('dual-os-2').addEventListener('change', validateDualSelection);
    
    // Order submission
    document.getElementById('submit-order-btn').addEventListener('click', submitOrder);
    
    // Return home button
    document.getElementById('return-home-btn').addEventListener('click', resetForm);
    
    // Order tracking
    document.getElementById('track-order-btn').addEventListener('click', trackOrders);
    
    // Back buttons
    document.getElementById('back-to-login').addEventListener('click', showLoginView);
    document.getElementById('back-to-home-btn').addEventListener('click', showClientView);
    
    // Form validation
    setupFormValidation();
}

// Populate OS options
function populateOSOptions(osData) {
    const osOptionsContainer = document.getElementById('os-options-container');
    const dualOS1 = document.getElementById('dual-os-1');
    const dualOS2 = document.getElementById('dual-os-2');
    
    // Clear existing options
    osOptionsContainer.innerHTML = '';
    dualOS1.innerHTML = '<option value="">Select First OS</option>';
    dualOS2.innerHTML = '<option value="">Select Second OS</option>';
    
    osData.forEach(os => {
        if (!os.is_active || os.versions.length === 0) return;
        
        // Create OS option for single installation
        const osOption = document.createElement('div');
        osOption.className = 'os-option border-2 border-gray-200 rounded-lg p-4 text-center cursor-pointer card-hover bg-white hover:bg-blue-50';
        osOption.dataset.osId = os.id;
        
        // Determine icon based on OS type/name
        let icon = 'fas fa-desktop';
        let colorClass = 'text-blue-600';
        
        if (os.name.toLowerCase().includes('windows')) {
            icon = 'fab fa-windows';
            colorClass = 'text-blue-600';
        } else if (os.name.toLowerCase().includes('ubuntu')) {
            icon = 'fab fa-ubuntu';
            colorClass = 'text-orange-600';
        } else if (os.name.toLowerCase().includes('linux')) {
            icon = 'fab fa-linux';
            colorClass = 'text-gray-800';
        }
        
        osOption.innerHTML = `
            <div class="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <i class="${icon} ${colorClass} text-xl"></i>
            </div>
            <h3 class="font-semibold text-gray-800">${os.name}</h3>
            <p class="text-sm text-gray-500">${os.versions.length} versions available</p>
        `;
        
        osOption.addEventListener('click', () => selectSingleOS(os.id));
        osOptionsContainer.appendChild(osOption);
        
        // Add to dual boot dropdowns
        const option1 = document.createElement('option');
        option1.value = os.id;
        option1.textContent = os.name;
        dualOS1.appendChild(option1.cloneNode(true));
        
        const option2 = option1.cloneNode(true);
        dualOS2.appendChild(option2);
    });
}

// Select installation type
function selectInstallationType(type) {
    // Store previous state for undo functionality
    const previousState = {
        installationType: appState.installationType,
        selectedOS: [...appState.selectedOS],
        selectedVersions: [...appState.selectedVersions]
    };
    
    // Only reset selections if actually changing type
    if (appState.installationType !== type) {
        // Ask user if they want to clear previous selections
        if (appState.selectedOS.length > 0) {
            const shouldClear = confirm(`Switching installation type will clear your current OS selections. Continue?`);
            if (!shouldClear) {
                return; // User cancelled, keep current state
            }
        }
        
        appState.selectedOS = [];
        appState.selectedVersions = [];
        
        // Clear UI selections
        document.querySelectorAll('.os-option.selected').forEach(el => el.classList.remove('selected'));
        document.getElementById('dual-os-1').value = '';
        document.getElementById('dual-os-2').value = '';
        clearDualSelectionError();
    }
    
    appState.installationType = type;
    
    // Update UI
    document.querySelectorAll('.install-type').forEach(el => {
        if (el.dataset.type === type) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });
    
    // Show appropriate OS selection section
    if (type === 'full') {
        document.getElementById('os-selection-full').classList.remove('hidden');
        document.getElementById('os-selection-dual').classList.add('hidden');
    } else {
        document.getElementById('os-selection-full').classList.add('hidden');
        document.getElementById('os-selection-dual').classList.remove('hidden');
    }
    
    // Show undo button
    showUndoButton(previousState);
    
    // Update real-time summary
    updateRealtimeSummary();
    
    // Enable continue button
    enableContinueButton();
}

// Show undo button
function showUndoButton(previousState) {
    if (previousState.installationType && previousState.installationType !== appState.installationType) {
        const undoButton = document.getElementById('undo-selection-btn');
        if (undoButton) {
            undoButton.classList.remove('hidden');
            undoButton.onclick = () => undoSelection(previousState);
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                undoButton.classList.add('hidden');
            }, 10000);
        }
    }
}

// Undo selection
function undoSelection(previousState) {
    appState.installationType = previousState.installationType;
    appState.selectedOS = [...previousState.selectedOS];
    appState.selectedVersions = [...previousState.selectedVersions];
    
    // Update UI to reflect previous state
    document.querySelectorAll('.install-type').forEach(el => {
        if (el.dataset.type === previousState.installationType) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });
    
    // Show appropriate OS selection section
    if (previousState.installationType === 'full') {
        document.getElementById('os-selection-full').classList.remove('hidden');
        document.getElementById('os-selection-dual').classList.add('hidden');
        
        // Restore full installation selection
        if (previousState.selectedOS.length > 0) {
            document.querySelectorAll('.os-option').forEach(el => {
                if (el.dataset.osId === previousState.selectedOS[0].toString()) {
                    el.classList.add('selected');
                } else {
                    el.classList.remove('selected');
                }
            });
        }
    } else {
        document.getElementById('os-selection-full').classList.add('hidden');
        document.getElementById('os-selection-dual').classList.remove('hidden');
        
        // Restore dual boot selection
        if (previousState.selectedOS.length >= 2) {
            document.getElementById('dual-os-1').value = previousState.selectedOS[0] || '';
            document.getElementById('dual-os-2').value = previousState.selectedOS[1] || '';
        }
    }
    
    // Hide undo button
    document.getElementById('undo-selection-btn').classList.add('hidden');
    
    // Update real-time summary
    updateRealtimeSummary();
    
    // Update continue button state
    if (previousState.selectedOS.length > 0) {
        enableContinueButton();
    } else {
        disableContinueButton();
    }
}

// Select single OS
function selectSingleOS(osId) {
    appState.selectedOS = [parseInt(osId)];
    // Reset version selection when OS changes
    appState.selectedVersions = [];
    
    // Update UI
    document.querySelectorAll('.os-option').forEach(el => {
        if (el.dataset.osId === osId.toString()) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });
    
    // Update real-time summary
    updateRealtimeSummary();
    
    enableContinueButton();
}

// Validate dual selection
function validateDualSelection() {
    const os1 = parseInt(document.getElementById('dual-os-1').value);
    const os2 = parseInt(document.getElementById('dual-os-2').value);
    
    console.log('Validating dual selection:', { os1, os2 });
    
    if (os1 && os2 && os1 !== os2) {
        appState.selectedOS = [os1, os2];
        // Reset version selections when OS changes
        appState.selectedVersions = [];
        console.log('Valid dual selection:', appState.selectedOS);
        enableContinueButton();
        
        // Clear any previous validation messages
        clearDualSelectionError();
        
        // Update real-time summary
        updateRealtimeSummary();
    } else {
        appState.selectedOS = [];
        appState.selectedVersions = [];
        disableContinueButton();
        
        // Update real-time summary
        updateRealtimeSummary();
        
        // Show validation error
        if (os1 && os2 && os1 === os2) {
            showDualSelectionError('Please select two different operating systems');
        } else if (!os1 || !os2) {
            showDualSelectionError('Please select both operating systems');
        }
    }
}

// Show dual selection error
function showDualSelectionError(message) {
    // Remove existing error
    clearDualSelectionError();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'dual-selection-error bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mt-2';
    errorDiv.textContent = message;
    
    const dualSelection = document.getElementById('os-selection-dual');
    dualSelection.appendChild(errorDiv);
}

// Clear dual selection error
function clearDualSelectionError() {
    const existingError = document.querySelector('.dual-selection-error');
    if (existingError) {
        existingError.remove();
    }
}

// Prepare version selection
function prepareVersionSelection() {
    const container = document.getElementById('version-selection-container');
    container.innerHTML = '';
    
    if (appState.installationType === 'full') {
        const os = appState.osData.find(os => os.id === appState.selectedOS[0]);
        createVersionSelector(os, 0);
    } else {
        const os1 = appState.osData.find(os => os.id === appState.selectedOS[0]);
        const os2 = appState.osData.find(os => os.id === appState.selectedOS[1]);
        
        createVersionSelector(os1, 0);
        createVersionSelector(os2, 1);
    }
}

// Create version selector
function createVersionSelector(os, index) {
    const container = document.getElementById('version-selection-container');
    
    const selectorDiv = document.createElement('div');
    selectorDiv.className = 'mb-6';
    
    selectorDiv.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Select ${os.name} Version</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="version-options-${index}">
        </div>
    `;
    
    container.appendChild(selectorDiv);
    
    const versionsContainer = document.getElementById(`version-options-${index}`);
    
    os.versions.forEach(version => {
        if (!version.is_active) return;
        
        const versionOption = document.createElement('div');
        versionOption.className = 'version-option border-2 border-gray-200 rounded-lg p-3 cursor-pointer card-hover bg-white hover:bg-blue-50';
        versionOption.dataset.osIndex = index;
        versionOption.dataset.versionId = version.id;
        
        versionOption.innerHTML = `
            <div class="flex items-center">
                <div class="bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center mr-3">
                    <i class="fas fa-compact-disc text-gray-600"></i>
                </div>
                <div>
                    <h4 class="font-medium text-gray-800">${version.name}</h4>
                    <p class="text-sm text-gray-500">${os.name}</p>
                </div>
            </div>
        `;
        
        versionOption.addEventListener('click', () => selectVersion(index, version.id));
        versionsContainer.appendChild(versionOption);
    });
}

// Select version
function selectVersion(osIndex, versionId) {
    if (!appState.selectedVersions) {
        appState.selectedVersions = [];
    }
    
    appState.selectedVersions[osIndex] = parseInt(versionId);
    
    // Update UI
    document.querySelectorAll(`[data-os-index="${osIndex}"]`).forEach(el => {
        if (el.dataset.versionId === versionId.toString()) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });
    
    // Update real-time summary
    updateRealtimeSummary();
    
    // Check if all versions are selected
    const expectedVersions = appState.installationType === 'full' ? 1 : 2;
    const selectedVersions = appState.selectedVersions.filter(v => v != null).length;
    
    if (selectedVersions === expectedVersions) {
        enableContinueButton();
    } else {
        disableContinueButton();
    }
}

// Go to next step
function goToNextStep() {
    console.log('Attempting to go to next step from:', appState.currentStep);
    console.log('Current state:', {
        installationType: appState.installationType,
        selectedOS: appState.selectedOS,
        selectedVersions: appState.selectedVersions
    });
    
    // Validate current step before proceeding
    if (appState.currentStep === 1) {
        if (!appState.installationType) {
            alert('Please select an installation type');
            return;
        }
    } else if (appState.currentStep === 2) {
        if (appState.selectedOS.length === 0) {
            alert('Please select operating system(s)');
            return;
        }
        prepareVersionSelection();
    } else if (appState.currentStep === 3) {
        const expectedVersions = appState.installationType === 'full' ? 1 : 2;
        const selectedVersions = appState.selectedVersions.filter(v => v != null).length;
        if (selectedVersions < expectedVersions) {
            alert(`Please select ${expectedVersions === 1 ? 'a version' : 'versions for both operating systems'}`);
            return;
        }
    } else if (appState.currentStep === 4 && !validateCustomerForm()) {
        return;
    }
    
    if (appState.currentStep < 5) {
        // Hide current step
        document.getElementById(`component-${appState.currentStep}`).classList.add('hidden');
        
        // Show next step
        appState.currentStep++;
        document.getElementById(`component-${appState.currentStep}`).classList.remove('hidden');
        
        // Update progress indicator
        updateProgressIndicator();
        
        // If moving to summary, update summary details
        if (appState.currentStep === 5) {
            updateOrderSummary();
        }
        
        // Reset continue button state
        disableContinueButton();
        if (appState.currentStep === 3) {
            // Check if versions should be enabled
            const expectedVersions = appState.installationType === 'full' ? 1 : 2;
            const selectedVersions = appState.selectedVersions.filter(v => v != null).length;
            if (selectedVersions >= expectedVersions) {
                enableContinueButton();
            }
        }
    }
}

// Go to previous step
function goToPreviousStep() {
    if (appState.currentStep > 1) {
        // Hide current step
        document.getElementById(`component-${appState.currentStep}`).classList.add('hidden');
        
        // Show previous step
        appState.currentStep--;
        document.getElementById(`component-${appState.currentStep}`).classList.remove('hidden');
        
        // Update progress indicator
        updateProgressIndicator();
        
        // Enable continue button for previous steps that have selections
        if (appState.currentStep === 1 && appState.installationType) {
            enableContinueButton();
        } else if (appState.currentStep === 2 && appState.selectedOS.length > 0) {
            enableContinueButton();
        } else if (appState.currentStep === 3 && appState.selectedVersions.length > 0) {
            enableContinueButton();
        }
    }
}

// Update progress indicator
function updateProgressIndicator() {
    const progressSteps = document.querySelectorAll('.flex.items-center > div.flex');
    
    progressSteps.forEach((step, index) => {
        const circle = step.querySelector('div:first-child');
        const label = step.querySelector('div:last-child');
        
        if (index < appState.currentStep - 1) {
            // Completed steps
            circle.className = 'rounded-full h-10 w-10 flex items-center justify-center bg-green-600 text-white';
            circle.innerHTML = '<i class="fas fa-check"></i>';
            label.className = 'mt-2 text-sm font-medium text-green-600';
        } else if (index === appState.currentStep - 1) {
            // Current step
            circle.className = 'rounded-full h-10 w-10 flex items-center justify-center bg-blue-600 text-white';
            circle.textContent = index + 1;
            label.className = 'mt-2 text-sm font-medium text-blue-600';
        } else {
            // Future steps
            circle.className = 'rounded-full h-10 w-10 flex items-center justify-center bg-gray-300';
            circle.textContent = index + 1;
            label.className = 'mt-2 text-sm font-medium text-gray-500';
        }
    });
    
    // Update progress lines
    const lines = document.querySelectorAll('.h-1.w-16');
    lines.forEach((line, index) => {
        if (index < appState.currentStep - 1) {
            line.className = 'h-1 w-16 bg-green-600';
        } else {
            line.className = 'h-1 w-16 bg-gray-300';
        }
    });
}

// Enable/disable continue button
function enableContinueButton() {
    document.querySelectorAll('.continue-btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    });
}

function disableContinueButton() {
    document.querySelectorAll('.continue-btn').forEach(btn => {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    });
}

// Form validation setup
function setupFormValidation() {
    const inputs = document.querySelectorAll('#component-4 input, #component-4 textarea');
    
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            clearValidation(this);
        });
    });
}

// Validate individual field
function validateField(field) {
    if (field.hasAttribute('required') && !field.value.trim()) {
        showError(field, 'This field is required');
        return false;
    }
    
    if (field.type === 'email' && field.value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value)) {
            showError(field, 'Please enter a valid email address');
            return false;
        }
    }
    
    if (field.id === 'customer-phone' && field.value.trim()) {
        const phoneRegex = /^07\d{8}$/;
        if (!phoneRegex.test(field.value.replace(/[\s-]/g, ''))) {
            showError(field, 'Phone number must start with 07 and have 10 digits');
            return false;
        }
    }
    
    clearValidation(field);
    return true;
}

// Show field error
function showError(field, message) {
    clearValidation(field);
    
    field.classList.add('border-red-500');
    
    const error = document.createElement('p');
    error.className = 'text-red-500 text-xs italic mt-1 field-error';
    error.textContent = message;
    
    field.parentNode.appendChild(error);
}

// Clear field validation
function clearValidation(field) {
    field.classList.remove('border-red-500');
    
    const error = field.parentNode.querySelector('.field-error');
    if (error) {
        error.remove();
    }
}

// Validate entire customer form
function validateCustomerForm() {
    const requiredFields = document.querySelectorAll('#component-4 input[required], #component-4 textarea[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
        }
    });
    
    return isValid;
}

// Submit order
async function submitOrder() {
    if (!validateCustomerForm()) {
        return;
    }
    
    // Collect customer info
    appState.customerInfo = {
        name: document.getElementById('customer-name').value.trim(),
        email: document.getElementById('customer-email').value.trim(),
        phone: document.getElementById('customer-phone').value.trim(),
        address: document.getElementById('customer-address').value.trim()
    };
    
    // Collect add-ons
    appState.addOns = {
        additionalDrivers: document.getElementById('additional-drivers').checked,
        officeSuite: document.getElementById('office-suite').checked
    };
    
    // Prepare order data
    const orderData = {
        orderNumber: appState.orderNumber,
        installationType: appState.installationType,
        customerName: appState.customerInfo.name,
        customerEmail: appState.customerInfo.email,
        customerPhone: appState.customerInfo.phone,
        customerAddress: appState.customerInfo.address,
        osSelections: [],
        addons: []
    };
    
    // Add OS selections
    if (appState.installationType === 'full') {
        orderData.osSelections.push({
            osId: appState.selectedOS[0],
            versionId: appState.selectedVersions[0]
        });
    } else {
        orderData.osSelections.push(
            {
                osId: appState.selectedOS[0],
                versionId: appState.selectedVersions[0]
            },
            {
                osId: appState.selectedOS[1],
                versionId: appState.selectedVersions[1]
            }
        );
    }
    
    // Add addons
    if (appState.addOns.additionalDrivers) {
        orderData.addons.push({
            type: 'additional_drivers',
            price: appState.pricing.additional_drivers
        });
    }
    
    if (appState.addOns.officeSuite) {
        orderData.addons.push({
            type: 'office_suite',
            price: appState.pricing.office_suite
        });
    }
    
    try {
        console.log('Submitting order:', orderData);
        const response = await apiCall('/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
        
        console.log('Order submitted successfully:', response);
        
        // Show success message
        alert('Order submitted successfully! Your order number is: ' + appState.orderNumber);
        
        // Go to summary step
        goToNextStep();
    } catch (error) {
        console.error('Error submitting order:', error);
        alert('Failed to submit your order. Please try again. Error: ' + (error.message || 'Unknown error'));
    }
}

// Update real-time summary for data integrity
function updateRealtimeSummary() {
    // Update a live preview in the component if needed
    const summaryElements = document.querySelectorAll('.live-summary');
    if (summaryElements.length > 0) {
        summaryElements.forEach(element => {
            let summaryText = 'No selections made';
            
            if (appState.installationType) {
                summaryText = `${appState.installationType === 'full' ? 'Full Installation' : 'Dual Boot Installation'}`;
                
                if (appState.selectedOS.length > 0) {
                    try {
                        if (appState.installationType === 'full') {
                            const os = appState.osData.find(os => os.id === appState.selectedOS[0]);
                            const version = os && appState.selectedVersions[0] ? 
                                os.versions.find(v => v.id === appState.selectedVersions[0]) : null;
                            
                            if (os && version) {
                                summaryText += ` - ${os.name} (${version.name})`;
                            } else if (os) {
                                summaryText += ` - ${os.name} (version pending)`;
                            }
                        } else {
                            const os1 = appState.osData.find(os => os.id === appState.selectedOS[0]);
                            const os2 = appState.osData.find(os => os.id === appState.selectedOS[1]);
                            
                            let osText = '';
                            if (os1) osText += os1.name;
                            if (os2) osText += (osText ? ' + ' : '') + os2.name;
                            
                            if (osText) {
                                summaryText += ` - ${osText}`;
                            }
                        }
                    } catch (error) {
                        console.error('Error updating real-time summary:', error);
                    }
                }
            }
            
            element.textContent = summaryText;
        });
    }
    
    console.log('Real-time summary updated:', {
        type: appState.installationType,
        selectedOS: appState.selectedOS,
        selectedVersions: appState.selectedVersions
    });
}

// Update order summary
function updateOrderSummary() {
    console.log('Updating order summary with state:', {
        installationType: appState.installationType,
        selectedOS: appState.selectedOS,
        selectedVersions: appState.selectedVersions,
        osData: appState.osData,
        customerInfo: appState.customerInfo,
        addOns: appState.addOns,
        pricing: appState.pricing
    });
    
    // Validate that we have the required data
    if (!appState.installationType || !appState.selectedOS.length || !appState.osData.length) {
        console.error('Missing required data for order summary');
        document.getElementById('summary-os').textContent = 'Error: Missing order data';
        document.getElementById('summary-type').textContent = 'Error: Missing data';
        return;
    }
    
    document.getElementById('summary-order-number').textContent = appState.orderNumber;
    document.getElementById('summary-type').textContent = 
        appState.installationType === 'full' ? 'Full Installation' : 'Dual Boot Installation';
    
    // Build OS summary with error handling - ALWAYS show OS names
    let osText = 'Not specified';
    try {
        if (appState.installationType === 'full') {
            const os = appState.osData.find(os => os.id === appState.selectedOS[0]);
            const version = os ? os.versions.find(v => v.id === appState.selectedVersions[0]) : null;
            if (os && version) {
                osText = `${os.name} (${version.name})`;
            } else if (os) {
                osText = `${os.name} (Version not selected)`;
            }
        } else if (appState.installationType === 'dual') {
            const os1 = appState.osData.find(os => os.id === appState.selectedOS[0]);
            const version1 = os1 ? os1.versions.find(v => v.id === appState.selectedVersions[0]) : null;
            const os2 = appState.osData.find(os => os.id === appState.selectedOS[1]);
            const version2 = os2 ? os2.versions.find(v => v.id === appState.selectedVersions[1]) : null;
            
            let part1 = 'First OS not selected';
            let part2 = 'Second OS not selected';
            
            if (os1 && version1) {
                part1 = `${os1.name} (${version1.name})`;
            } else if (os1) {
                part1 = `${os1.name} (Version not selected)`;
            }
            
            if (os2 && version2) {
                part2 = `${os2.name} (${version2.name})`;
            } else if (os2) {
                part2 = `${os2.name} (Version not selected)`;
            }
            
            osText = `${part1} + ${part2}`;
        }
    } catch (error) {
        console.error('Error building OS summary:', error);
        osText = 'Error loading OS information';
    }
    
    console.log('Generated OS text:', osText);
    document.getElementById('summary-os').textContent = osText;
    
    // Calculate and display pricing
    let basePrice = appState.installationType === 'full' 
        ? appState.pricing.full_installation 
        : appState.pricing.dual_boot_installation;
    let totalPrice = basePrice;
    
    document.getElementById('summary-base-price').textContent = `KSh ${basePrice}`;
    
    const addonsContainer = document.getElementById('summary-addons');
    addonsContainer.innerHTML = '';
    
    if (appState.addOns.additionalDrivers) {
        totalPrice += appState.pricing.additional_drivers;
        addonsContainer.innerHTML += `<div class="text-gray-700"><span class="font-medium">Additional Drivers:</span> +KSh ${appState.pricing.additional_drivers}</div>`;
    }
    
    if (appState.addOns.officeSuite) {
        totalPrice += appState.pricing.office_suite;
        addonsContainer.innerHTML += `<div class="text-gray-700"><span class="font-medium">Office Suite:</span> +KSh ${appState.pricing.office_suite}</div>`;
    }
    
    document.getElementById('summary-total-price').textContent = `KSh ${totalPrice}`;
    
    // Customer info
    document.getElementById('summary-customer').innerHTML = `
        <div>${appState.customerInfo.name}</div>
        <div>${appState.customerInfo.email}</div>
        <div>${appState.customerInfo.phone}</div>
        <div>${appState.customerInfo.address}</div>
    `;
}

// Reset form to initial state
function resetForm() {
    appState.currentStep = 1;
    appState.installationType = null;
    appState.selectedOS = [];
    appState.selectedVersions = [];
    appState.customerInfo = {};
    appState.addOns = {};
    appState.orderNumber = generateOrderNumber();
    
    // Reset UI
    document.getElementById('order-number').textContent = appState.orderNumber;
    
    // Clear form fields
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-email').value = '';
    document.getElementById('customer-phone').value = '';
    document.getElementById('customer-address').value = '';
    document.getElementById('additional-drivers').checked = false;
    document.getElementById('office-suite').checked = false;
    
    // Reset selections
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    document.getElementById('dual-os-1').value = '';
    document.getElementById('dual-os-2').value = '';
    
    // Show first component
    document.querySelectorAll('.component').forEach((component, index) => {
        if (index === 0) {
            component.classList.remove('hidden');
        } else {
            component.classList.add('hidden');
        }
    });
    
    updateProgressIndicator();
    disableContinueButton();
    showClientView();
}

// View management
function showClientView() {
    document.getElementById('client-view').classList.remove('hidden');
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('order-status-view').classList.add('hidden');
}

function showLoginView() {
    document.getElementById('client-view').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('order-status-view').classList.add('hidden');
}

// Track orders
async function trackOrders() {
    const email = document.getElementById('login-email').value.trim();
    const phone = document.getElementById('login-phone').value.trim();
    
    if (!email || !phone) {
        alert('Please fill in both email and phone number');
        return;
    }
    
    // Validate phone format
    const phoneRegex = /^07\d{8}$/;
    if (!phoneRegex.test(phone.replace(/[\s-]/g, ''))) {
        alert('Please enter a valid phone number (format: 0793587167)');
        return;
    }
    
    try {
        const orders = await apiCall('/orders/find', {
            method: 'POST',
            body: JSON.stringify({ email, phone })
        });
        
        displayOrders(orders);
        
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('order-status-view').classList.remove('hidden');
    } catch (error) {
        console.error('Error tracking orders:', error);
        alert('No orders found with the provided information.');
    }
}

// Display orders
function displayOrders(orders) {
    const container = document.getElementById('orders-container');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">No orders found.</p>';
        return;
    }
    
    container.innerHTML = '';
    
    orders.forEach(order => {
        const orderDiv = document.createElement('div');
        orderDiv.className = 'bg-gray-50 p-4 rounded-lg mb-4';
        
        const statusClass = getStatusClass(order.status);
        const progressWidth = getProgressWidth(order.status);
        
        orderDiv.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <h3 class="font-semibold text-lg">Order #${order.order_number}</h3>
                <span class="px-3 py-1 rounded-full text-xs ${statusClass}">${order.status.toUpperCase()}</span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <p class="text-gray-600"><strong>Type:</strong> ${order.installation_type === 'full' ? 'Full Installation' : 'Dual Boot'}</p>
                    <p class="text-gray-600"><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                    <p class="text-gray-600"><strong>OS:</strong> ${getOSText(order)}</p>
                    <p class="text-gray-600"><strong>Updated:</strong> ${new Date(order.updated_at).toLocaleDateString()}</p>
                </div>
            </div>
            
            <div class="mb-3">
                <div class="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>${Math.round(progressWidth)}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="h-2 rounded-full transition-all duration-300 ${getProgressColor(order.status)}" style="width: ${progressWidth}%"></div>
                </div>
            </div>
        `;
        
        container.appendChild(orderDiv);
    });
}

// Helper function to get OS text for order display
function getOSText(order) {
    if (!order.os_selections || order.os_selections.length === 0) {
        return 'Not specified';
    }
    
    return order.os_selections.map(sel => sel.version_name || sel.os_name).join(' + ');
}

// Get status styling class
function getStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'pending':
            return 'order-status-pending';
        case 'in_progress':
            return 'order-status-progress';
        case 'completed':
            return 'order-status-completed';
        case 'rejected':
            return 'order-status-rejected';
        default:
            return 'order-status-pending';
    }
}

// Get progress width based on status
function getProgressWidth(status) {
    switch (status.toLowerCase()) {
        case 'pending':
            return 25;
        case 'in_progress':
            return 60;
        case 'completed':
            return 100;
        case 'rejected':
            return 100;
        default:
            return 25;
    }
}

// Get progress bar color
function getProgressColor(status) {
    switch (status.toLowerCase()) {
        case 'pending':
            return 'bg-yellow-500';
        case 'in_progress':
            return 'bg-blue-500';
        case 'completed':
            return 'bg-green-500';
        case 'rejected':
            return 'bg-red-500';
        default:
            return 'bg-gray-500';
    }
}

// Toggle modal visibility
function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.toggle('hidden');
}

// Error handling
window.addEventListener('error', function(event) {
    console.error('JavaScript Error:', event.error);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled Promise Rejection:', event.reason);
});

// Setup admin button activation
function setupAdminActivation() {
    let clickCount = 0;
    let clickTimer = null;
    
    const logo = document.querySelector('.fas.fa-laptop-code');
    if (logo) {
        logo.addEventListener('click', function() {
            clickCount++;
            
            if (clickCount === 1) {
                clickTimer = setTimeout(() => {
                    clickCount = 0;
                }, 2000); // Reset after 2 seconds
            }
            
            if (clickCount === 3) {
                // Triple-click detected - show admin button
                const adminBtn = document.getElementById('admin-btn');
                if (adminBtn) {
                    adminBtn.classList.remove('hidden');
                    // Store in localStorage so it stays visible
                    localStorage.setItem('techserve_admin_visible', 'true');
                    
                    // Show success message
                    const toast = document.createElement('div');
                    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
                    toast.innerHTML = '<i class="fas fa-check mr-2"></i>Admin panel activated!';
                    document.body.appendChild(toast);
                    
                    setTimeout(() => {
                        toast.remove();
                    }, 3000);
                }
                
                clickCount = 0;
                clearTimeout(clickTimer);
            }
        });
    }
    
    // Check if admin button should be visible from previous sessions
    if (localStorage.getItem('techserve_admin_visible') === 'true') {
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) {
            adminBtn.classList.remove('hidden');
        }
    }
}

// Function to hide admin button (for future use)
function hideAdminButton() {
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
        adminBtn.classList.add('hidden');
        localStorage.removeItem('techserve_admin_visible');
    }
}

// Note: Initialization handled by DOMContentLoaded event listener above
