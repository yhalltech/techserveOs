// Add authentication check at the beginning
async function checkAuth() {
    try {
        const response = await fetch('/api/admin/check-auth');
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = 'admin-login.html';
            return false;
        }
        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = 'admin-login.html';
        return false;
    }
}

// Global admin state
const adminState = {
    operatingSystems: [],
    orders: [],
    currentTab: 'orders'
};

// Modify the initialization to check authentication
document.addEventListener('DOMContentLoaded', async function() {
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) return;
    
    // Initialize admin functionality
    await initializeAdmin();
});

// Add logout functionality
document.getElementById('logout-btn').addEventListener('click', async function() {
    try {
        await fetch('/api/admin/logout', {
            method: 'POST'
        });
        window.location.href = 'admin-login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Add edit functionality for OS and versions
function addEditFunctionality() {
    // Add edit buttons to OS items
    document.querySelectorAll('.os-item').forEach(item => {
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-os-btn text-blue-600 hover:text-blue-800 ml-2';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.dataset.osId = item.dataset.osId;
        item.querySelector('.flex.items-center').appendChild(editBtn);
    });
    
    // Add event listeners for edit buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('.edit-os-btn')) {
            const osId = e.target.closest('.edit-os-btn').dataset.osId;
            editOperatingSystem(osId);
        }
        
        if (e.target.closest('.edit-version-btn')) {
            const versionId = e.target.closest('.edit-version-btn').dataset.versionId;
            editOSVersion(versionId);
        }
    });
}

// Edit operating system
async function editOperatingSystem(osId) {
    const os = adminState.operatingSystems.find(os => os.id == osId);
    
    if (!os) return;
    
    // Populate the edit form
    document.getElementById('edit-os-id').value = os.id;
    document.getElementById('edit-os-name').value = os.name;
    document.getElementById('edit-os-type').value = os.type;
    document.getElementById('edit-os-logo-url').value = os.logo_url || '';
    document.getElementById('edit-os-active').checked = os.is_active;
    
    // Show the edit modal
    document.getElementById('edit-os-modal').classList.remove('hidden');
}

// Edit OS version
async function editOSVersion(versionId) {
    // Find the version across all OSes
    let version = null;
    let osName = '';
    
    for (const os of adminState.operatingSystems) {
        if (os.versions) {
            const foundVersion = os.versions.find(v => v.id == versionId);
            if (foundVersion) {
                version = foundVersion;
                osName = os.name;
                break;
            }
        }
    }
    
    if (!version) return;
    
    // Populate the edit form
    document.getElementById('edit-version-id').value = version.id;
    document.getElementById('edit-version-os-name').textContent = osName;
    document.getElementById('edit-version-name').value = version.name;
    document.getElementById('edit-version-active').checked = version.is_active;
    
    // Show the edit modal
    document.getElementById('edit-version-modal').classList.remove('hidden');
}

// Update operating system
async function updateOperatingSystem() {
    const osId = document.getElementById('edit-os-id').value;
    const name = document.getElementById('edit-os-name').value;
    const type = document.getElementById('edit-os-type').value;
    const logo_url = document.getElementById('edit-os-logo-url').value;
    const is_active = document.getElementById('edit-os-active').checked;
    
    try {
        const response = await fetch(`/api/admin/operating-systems/${osId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, type, logo_url, is_active })
        });
        
        if (!response.ok) throw new Error('Failed to update OS');
        
        alert('Operating system updated successfully');
        document.getElementById('edit-os-modal').classList.add('hidden');
        loadOperatingSystems();
    } catch (error) {
        console.error('Error updating OS:', error);
        alert('Error updating operating system. Please try again.');
    }
}

// Update OS version
async function updateOSVersion() {
    const versionId = document.getElementById('edit-version-id').value;
    const version = document.getElementById('edit-version-name').value;
    const is_active = document.getElementById('edit-version-active').checked;
    
    try {
        const response = await fetch(`/api/admin/os-versions/${versionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ version, is_active })
        });
        
        if (!response.ok) throw new Error('Failed to update version');
        
        alert('OS version updated successfully');
        document.getElementById('edit-version-modal').classList.add('hidden');
        loadOperatingSystems();
    } catch (error) {
        console.error('Error updating OS version:', error);
        alert('Error updating OS version. Please try again.');
    }
}

// Delete operating system
async function deleteOperatingSystem(osId, osName) {
    if (!confirm(`Are you sure you want to delete "${osName}"? This will also delete all its versions. This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/operating-systems/${osId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete operating system');
        }
        
        alert('Operating system deleted successfully');
        loadOperatingSystems();
        
    } catch (error) {
        console.error('Error deleting OS:', error);
        alert(`Error: ${error.message}`);
    }
}

// Delete OS version
async function deleteOSVersion(versionId, versionName, osName) {
    if (!confirm(`Are you sure you want to delete "${osName} ${versionName}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/os-versions/${versionId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete OS version');
        }
        
        alert('OS version deleted successfully');
        loadOperatingSystems();
        
    } catch (error) {
        console.error('Error deleting OS version:', error);
        alert(`Error: ${error.message}`);
    }
}

// Initialize admin functionality
async function initializeAdmin() {
    try {
        // Setup tab switching
        setupTabSwitching();
        
        // Load initial data
        await loadOrders();
        await loadOperatingSystems();
        
        // Setup form handlers
        setupFormHandlers();
        
        console.log('Admin panel initialized successfully');
    } catch (error) {
        console.error('Failed to initialize admin panel:', error);
    }
}

// Setup tab switching functionality
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => {
                btn.classList.remove('border-blue-500', 'text-blue-600');
                btn.classList.add('text-gray-600', 'hover:text-blue-600');
            });
            
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            
            // Add active class to clicked button
            this.classList.add('border-blue-500', 'text-blue-600');
            this.classList.remove('text-gray-600', 'hover:text-blue-600');
            
            // Show target content
            document.getElementById(`tab-${targetTab}`).classList.add('active');
            
            adminState.currentTab = targetTab;
            
            // Load data for the tab
            if (targetTab === 'orders') {
                loadOrders();
            } else if (targetTab === 'os-management') {
                loadOperatingSystems();
            }
        });
    });
}

// Load orders from backend
async function loadOrders() {
    try {
        const response = await fetch('/api/admin/orders');
        if (!response.ok) throw new Error('Failed to load orders');
        
        const orders = await response.json();
        adminState.orders = orders;
        
        renderOrdersTable(orders);
        
        console.log('Orders loaded:', orders);
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('orders-table-body').innerHTML = 
            '<tr><td colspan="6" class="py-4 px-4 text-center text-red-500">Failed to load orders</td></tr>';
    }
}

// Render orders table
function renderOrdersTable(orders) {
    const tbody = document.getElementById('orders-table-body');
    
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-4 px-4 text-center text-gray-500">No orders found</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map(order => {
        const statusClass = getStatusBadgeClass(order.status);
        const osText = getOrderOSText(order);
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="py-2 px-4 border-b font-medium">${order.order_number}</td>
                <td class="py-2 px-4 border-b">
                    <div class="font-medium">${order.customer_name}</div>
                    <div class="text-sm text-gray-500">${order.customer_email}</div>
                </td>
                <td class="py-2 px-4 border-b">
                    <div>${order.installation_type === 'full' ? 'Full Installation' : 'Dual Boot'}</div>
                    <div class="text-sm text-gray-500">${osText}</div>
                </td>
                <td class="py-2 px-4 border-b text-sm">${new Date(order.created_at).toLocaleDateString()}</td>
                <td class="py-2 px-4 border-b">
                    <select class="px-2 py-1 border rounded ${statusClass}" onchange="updateOrderStatus(${order.id}, this.value)">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="in_progress" ${order.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                        <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="rejected" ${order.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td class="py-2 px-4 border-b">
                    <button onclick="viewOrderDetails(${order.id})" class="text-blue-600 hover:text-blue-800 mr-2" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Get status badge class
function getStatusBadgeClass(status) {
    switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'in_progress': return 'bg-blue-100 text-blue-800';
        case 'completed': return 'bg-green-100 text-green-800';
        case 'rejected': return 'bg-red-100 text-red-800';
        case 'cancelled': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

// Get order OS text
function getOrderOSText(order) {
    if (!order.os_selections || order.os_selections.length === 0) {
        return 'Not specified';
    }
    return order.os_selections.map(sel => `${sel.os_name || 'Unknown'} ${sel.version_name || ''}`).join(' + ');
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
    try {
        const response = await fetch(`/api/admin/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (!response.ok) throw new Error('Failed to update order status');
        
        // Reload orders to reflect changes
        await loadOrders();
        
        console.log(`Order ${orderId} status updated to ${newStatus}`);
    } catch (error) {
        console.error('Error updating order status:', error);
        alert('Failed to update order status. Please try again.');
        // Reload to reset the select back to original value
        await loadOrders();
    }
}

// View order details
function viewOrderDetails(orderId) {
    const order = adminState.orders.find(o => o.id === orderId);
    if (!order) return;
    
    const modal = document.getElementById('order-detail-modal');
    const content = document.getElementById('order-detail-content');
    
    content.innerHTML = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div><strong>Order Number:</strong> ${order.order_number}</div>
                <div><strong>Status:</strong> <span class="px-2 py-1 rounded text-sm ${getStatusBadgeClass(order.status)}">${order.status.toUpperCase()}</span></div>
                <div><strong>Type:</strong> ${order.installation_type === 'full' ? 'Full Installation' : 'Dual Boot'}</div>
                <div><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</div>
            </div>
            
            <div>
                <strong>Customer Information:</strong>
                <div class="mt-2 p-3 bg-gray-50 rounded">
                    <div><strong>Name:</strong> ${order.customer_name}</div>
                    <div><strong>Email:</strong> ${order.customer_email}</div>
                    <div><strong>Phone:</strong> ${order.customer_phone}</div>
                    <div><strong>Address:</strong> ${order.customer_address}</div>
                </div>
            </div>
            
            <div>
                <strong>OS Selections:</strong>
                <div class="mt-2 p-3 bg-gray-50 rounded">
                    ${order.os_selections && order.os_selections.length > 0 ? 
                        order.os_selections.map(sel => 
                            `<div>${sel.os_name || 'Unknown'} - ${sel.version_name || 'Unknown Version'}</div>`
                        ).join('') : 
                        '<div class="text-gray-500">No OS selections found</div>'
                    }
                </div>
            </div>
            
            ${order.addons && order.addons.length > 0 ? `
            <div>
                <strong>Add-ons:</strong>
                <div class="mt-2 p-3 bg-gray-50 rounded">
                    ${order.addons.map(addon => 
                        `<div>${addon.addon_type.replace('_', ' ').toUpperCase()} - KSh ${addon.price}</div>`
                    ).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    modal.classList.remove('hidden');
}

// Load operating systems
async function loadOperatingSystems() {
    try {
        const response = await fetch('/api/admin/operating-systems');
        if (!response.ok) throw new Error('Failed to load operating systems');
        
        const operatingSystems = await response.json();
        adminState.operatingSystems = operatingSystems;
        
        renderOSList(operatingSystems);
        populateOSSelect(operatingSystems);
        
        console.log('Operating systems loaded:', operatingSystems);
    } catch (error) {
        console.error('Error loading operating systems:', error);
        document.getElementById('os-list').innerHTML = 
            '<div class="text-center py-4 text-red-500">Failed to load operating systems</div>';
    }
}

// Populate OS select dropdown
function populateOSSelect(operatingSystems) {
    const select = document.getElementById('os-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select OS</option>';
    
    operatingSystems.forEach(os => {
        if (os.is_active) {
            select.innerHTML += `<option value="${os.id}">${os.name}</option>`;
        }
    });
}

// Setup form handlers
function setupFormHandlers() {
    // Add OS form
    document.getElementById('add-os-btn')?.addEventListener('click', addOperatingSystem);
    
    // Add version form
    document.getElementById('add-version-btn')?.addEventListener('click', addOSVersion);
    
    // Refresh orders button
    document.getElementById('refresh-orders')?.addEventListener('click', loadOrders);
    
    // Modal close handlers
    document.getElementById('close-order-detail')?.addEventListener('click', function() {
        document.getElementById('order-detail-modal').classList.add('hidden');
    });
    
    // Pricing update handlers
    document.getElementById('update-pricing-btn')?.addEventListener('click', updatePricing);
    document.getElementById('update-services-btn')?.addEventListener('click', updateServices);
}

// Add new operating system
async function addOperatingSystem() {
    const name = document.getElementById('os-name').value.trim();
    const type = document.getElementById('os-type').value;
    const logoUrl = document.getElementById('os-logo-url').value.trim();
    
    if (!name || !type) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/operating-systems', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, type, logo_url: logoUrl })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add operating system');
        }
        
        // Clear form
        document.getElementById('os-name').value = '';
        document.getElementById('os-type').value = 'windows';
        document.getElementById('os-logo-url').value = '';
        
        // Reload data
        await loadOperatingSystems();
        
        alert('Operating system added successfully!');
    } catch (error) {
        console.error('Error adding OS:', error);
        alert('Error: ' + error.message);
    }
}

// Add new OS version
async function addOSVersion() {
    const osId = document.getElementById('os-select').value;
    const version = document.getElementById('os-version').value.trim();
    
    if (!osId || !version) {
        alert('Please select an OS and enter a version');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/os-versions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ os_id: parseInt(osId), version })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add OS version');
        }
        
        // Clear form
        document.getElementById('os-select').value = '';
        document.getElementById('os-version').value = '';
        
        // Reload data
        await loadOperatingSystems();
        
        alert('OS version added successfully!');
    } catch (error) {
        console.error('Error adding OS version:', error);
        alert('Error: ' + error.message);
    }
}

// Update pricing
async function updatePricing() {
    const fullPrice = document.getElementById('full-installation-price').value;
    const dualPrice = document.getElementById('dual-boot-price').value;
    
    try {
        const response = await fetch('/api/admin/pricing', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                full_installation: parseFloat(fullPrice),
                dual_boot: parseFloat(dualPrice)
            })
        });
        
        if (!response.ok) throw new Error('Failed to update pricing');
        
        alert('Pricing updated successfully!');
    } catch (error) {
        console.error('Error updating pricing:', error);
        alert('Error updating pricing: ' + error.message);
    }
}

// Update services pricing
async function updateServices() {
    const driversPrice = document.getElementById('additional-drivers-price').value;
    const officePrice = document.getElementById('office-suite-price').value;
    
    try {
        const response = await fetch('/api/admin/pricing', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                additional_drivers: parseFloat(driversPrice),
                office_suite: parseFloat(officePrice)
            })
        });
        
        if (!response.ok) throw new Error('Failed to update services pricing');
        
        alert('Services pricing updated successfully!');
    } catch (error) {
        console.error('Error updating services pricing:', error);
        alert('Error updating services pricing: ' + error.message);
    }
}

// Enhanced OS list rendering with delete buttons
function renderOSList(operatingSystems) {
    const osListContainer = document.getElementById('os-list');
    
    if (!operatingSystems || operatingSystems.length === 0) {
        osListContainer.innerHTML = '<div class="text-center py-4 text-gray-500">No operating systems found.</div>';
        return;
    }
    
    osListContainer.innerHTML = '';
    
    operatingSystems.forEach(os => {
        const osDiv = document.createElement('div');
        osDiv.className = 'bg-white border rounded-lg p-4';
        osDiv.dataset.osId = os.id;
        
        let versionsHtml = '';
        if (os.versions && os.versions.length > 0) {
            versionsHtml = os.versions.map(version => `
                <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded border-l-4 ${
                    version.is_active ? 'border-green-400' : 'border-red-400'
                }">
                    <div class="flex items-center">
                        <span class="text-sm ${version.is_active ? 'text-gray-700' : 'text-gray-400'}">  
                            ${version.name}
                        </span>
                        <span class="ml-2 px-2 py-1 text-xs rounded ${
                            version.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }">
                            ${version.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="editOSVersion(${version.id})" 
                                class="text-blue-600 hover:text-blue-800 text-sm" 
                                title="Edit Version">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteOSVersion(${version.id}, '${version.name}', '${os.name}')" 
                                class="text-red-600 hover:text-red-800 text-sm" 
                                title="Delete Version">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            versionsHtml = '<div class="text-gray-500 text-sm py-2">No versions available</div>';
        }
        
        osDiv.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                        os.type === 'windows' ? 'bg-blue-100' : 'bg-gray-100'
                    }">
                        <i class="fas fa-${os.type === 'windows' ? 'windows' : 'linux'} text-${
                        os.type === 'windows' ? 'blue' : 'gray'
                    }-600"></i>
                    </div>
                    <div>
                        <h5 class="font-semibold ${os.is_active ? 'text-gray-800' : 'text-gray-400'}">
                            ${os.name}
                        </h5>
                        <p class="text-xs text-gray-500">
                            ${os.type.charAt(0).toUpperCase() + os.type.slice(1)} • 
                            ${os.versions ? os.versions.length : 0} versions
                        </p>
                    </div>
                    <span class="ml-3 px-2 py-1 text-xs rounded ${
                        os.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }">
                        ${os.is_active ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div class="flex space-x-2">
                    <button onclick="editOperatingSystem(${os.id})" 
                            class="text-blue-600 hover:text-blue-800" 
                            title="Edit OS">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteOperatingSystem(${os.id}, '${os.name}')" 
                            class="text-red-600 hover:text-red-800" 
                            title="Delete OS">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="space-y-2">
                <h6 class="text-sm font-medium text-gray-700">Versions:</h6>
                ${versionsHtml}
            </div>
        `;
        
        osListContainer.appendChild(osDiv);
    });
}
