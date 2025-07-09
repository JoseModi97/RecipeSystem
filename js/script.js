// Global variables
const API_BASE_URL = 'https://dummyjson.com/recipes';
const RECIPES_PER_PAGE = 30;
const SKELETON_CARDS_COUNT = 9; // Number of skeleton cards to show
let currentPage = 1;
let totalRecipes = 0;
let currentRecipes = []; // To store all fetched recipes

// DOM Elements
const recipeCardGrid = $('#recipeCardGrid');
const paginationControls = $('#paginationControls');
const searchInput = $('#searchInput');
const searchForm = $('#searchForm');
const tagFilterOptions = $('#tagFilterOptions');
const mealTypeFilterOptions = $('#mealTypeFilterOptions');
const sortBySelect = $('#sortBySelect');
const sortOrderSelect = $('#sortOrderSelect');
const recipeDetailModalElement = document.getElementById('recipeDetailModal');
const recipeDetailModal = new bootstrap.Modal(recipeDetailModalElement);
const recipeDetailModalBody = $('#recipeDetailModalBody');
const recipeDetailModalLabel = $('#recipeDetailModalLabel');
const addEditRecipeModalElement = document.getElementById('addEditRecipeModal');
const addEditRecipeModal = new bootstrap.Modal(addEditRecipeModalElement);
const addEditRecipeForm = $('#addEditRecipeForm');
const addEditRecipeModalLabel = $('#addEditRecipeModalLabel');
const addRecipeBtn = $('#addRecipeBtn');
const editRecipeModalBtn = $('#editRecipeModalBtn');
const deleteRecipeModalBtn = $('#deleteRecipeModalBtn');
// const loadingSpinnerModal = new bootstrap.Modal(document.getElementById('loadingSpinnerModal')); // Old spinner

// Utility Functions
function createSkeletonCard() {
    return `
        <div class="col recipe-card-col skeleton-card">
            <div class="card h-100 shadow-sm">
                <div class="skeleton skeleton-image"></div>
                <div class="card-body d-flex flex-column">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="mt-auto">
                        <div class="skeleton skeleton-button"></div>
                    </div>
                </div>
            </div>
        </div>`;
}

function showLoader() {
    recipeCardGrid.empty(); // Clear previous content
    for (let i = 0; i < SKELETON_CARDS_COUNT; i++) {
        recipeCardGrid.append(createSkeletonCard());
    }
    // Ensure pagination is hidden if it was visible due to a previous error state with no results
    paginationControls.addClass("d-none");
}

function hideLoader() {
    // Skeleton cards are removed by displayRecipes, so this function is now a no-op.
    // Kept for conceptual integrity or if direct hiding becomes necessary later.
    // The old spinner hiding logic is removed:
    // setTimeout(() => { loadingSpinnerModal.hide(); }, 250);
}

function showToast(message, type = 'success') {
    const toastId = `toast-${Date.now()}`;
    const toastHTML = `<div id="${toastId}" class="toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'} border-0" role="alert" aria-live="assertive" aria-atomic="true"><div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div></div>`;
    $('.toast-container').append(toastHTML);
    const toastElement = new bootstrap.Toast(document.getElementById(toastId));
    toastElement.show();
    $(`#${toastId}`).on('hidden.bs.toast', function () { $(this).remove(); });
}

// --- Recipe Display Functions ---
function createRecipeCard(recipe) {
    return `<div class="col recipe-card-col" data-recipe-id="${recipe.id}"><div class="card h-100 shadow-sm"><img src="${recipe.image}" class="card-img-top" alt="${recipe.name}" style="height: 200px; object-fit: cover;" loading="lazy"><div class="card-body d-flex flex-column"><h5 class="card-title">${recipe.name}</h5><p class="card-text mb-1"><small class="text-muted">Cuisine: ${recipe.cuisine}</small></p><p class="card-text mb-1"><small class="text-muted">Difficulty: ${recipe.difficulty}</small></p><p class="card-text mb-1"><small class="text-muted">Rating: ${recipe.rating ? recipe.rating.toFixed(1) : 'N/A'} <i class="bi bi-star-fill text-warning"></i> (${recipe.reviewCount || 0} reviews)</small></p><p class="card-text"><small class="text-muted">Calories: ${recipe.caloriesPerServing}</small></p><div class="mt-auto"><button class="btn btn-primary w-100 view-recipe-btn" data-id="${recipe.id}">View Recipe</button></div></div></div></div>`;
}
function displayRecipes(recipes) {
    recipeCardGrid.empty(); // This will clear skeleton cards or previous recipes
    if (!recipes || recipes.length === 0) {
        recipeCardGrid.html('<div class="col-12"><p class="text-center mt-5">No recipes found.</p></div>');
        totalRecipes = 0; // Ensure totalRecipes is updated for "no results"
    } else {
        recipes.forEach(recipe => { recipeCardGrid.append(createRecipeCard(recipe)); });
    }
    updatePagination(); // This will correctly show/hide pagination based on totalRecipes
}

// --- API Fetching Functions ---
async function fetchFromAPI(endpoint, queryParams = {}, method = 'GET', body = null, isSearch = false, isSingleRecipe = false, isFilter = false) {
    // For single recipe fetch (view details, edit prep), we don't want to show grid skeleton loaders.
    // The modal for details has its own loading state if needed, or content appears quickly.
    // Add/Edit/Delete operations also don't need grid skeletons.
    if (!isSingleRecipe && method === 'GET' && (endpoint === API_BASE_URL || endpoint.startsWith('tag/') || endpoint.startsWith('meal-type/') || isSearch)) {
        showLoader();
    } else if (method !== 'GET' && !isSingleRecipe) { // POST (add) might show a loader, but not grid skeleton
        // For now, non-GET, non-single recipe calls (like POST to /add) won't use the grid skeleton loader.
        // If a specific loader is needed for these, it would be a different implementation (e.g., button spinner).
    }


    let url;
    const options = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (body && (method === 'POST' || method === 'PUT')) options.body = JSON.stringify(body);

    if (isSingleRecipe || method === 'PUT' || method === 'DELETE') { url = `${API_BASE_URL}/${endpoint}`; }
    else if (method === 'POST' && endpoint === 'add') { url = `${API_BASE_URL}/add`; }
    else if (isSearch) { url = `${API_BASE_URL}/search?q=${encodeURIComponent(queryParams.q)}&limit=${queryParams.limit}&skip=${queryParams.skip}`; }
    else if (isFilter) { url = `${API_BASE_URL}/${endpoint}?limit=${queryParams.limit}&skip=${queryParams.skip}`; }
    else { const params = new URLSearchParams(queryParams); url = `${API_BASE_URL}?${params.toString()}`; }

    try {
        const response = await fetch(url, options);
        if (method === 'DELETE') { // DummyJSON returns the "deleted" object on success or 204
            if (response.ok) { // status 200-299
                 if (response.status === 204) return { id: endpoint, isDeleted: true, message: "Successfully deleted (no content)"}; // Simulate success for 204
                 const deletedData = await response.json();
                 return { ...deletedData, isDeleted: true}; // Add isDeleted flag
            } else {
                 throw new Error(`HTTP error! status: ${response.status} on ${url} method ${method}`);
            }
        }
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status} on ${url} method ${method}`); }

        const data = await response.json();

        if (isSingleRecipe || method === 'POST' || method === 'PUT') { return data; }
        else {
            currentRecipes = data.recipes; totalRecipes = data.total;
            if ((isFilter || isSearch) && typeof data.total === 'undefined') { totalRecipes = data.recipes ? data.recipes.length : 0; }
            displayRecipes(currentRecipes);
        }
    } catch (error) {
        console.error('Error in API call:', error); showToast(`API Error: ${error.message}`, 'danger');
        if (!isSingleRecipe && method === 'GET' && method !== 'DELETE') {
            // Ensure skeleton loaders are cleared on error and an error message is shown.
            // displayRecipes([]) will handle clearing the grid and showing "No recipes found."
            // or we can set a specific error message.
            recipeCardGrid.html('<div class="col-12"><p class="text-center text-danger mt-5">Could not load recipes.</p></div>');
            totalRecipes = 0;
            updatePagination(); // Hide pagination on error
        }
        return null;
    } finally {
        // hideLoader() is now a no-op, skeleton is cleared by displayRecipes or error message.
        // Only call hideLoader if it were a different type of loader (e.g. a global spinner, not grid items)
        // For grid skeletons, the content itself (or error message) replaces them.
        // No explicit hideLoader() call needed here if showLoader populated the grid.
    }
}
function fetchAllRecipes(skip = 0, limit = RECIPES_PER_PAGE) {
    const queryParams = { limit: limit, skip: skip, sortBy: sortBySelect.val(), order: sortOrderSelect.val() };
    currentApiCallState = { type: 'all', query: null, params: queryParams };
    fetchFromAPI(API_BASE_URL, queryParams);
}

// --- Filter Functions --- (Minified)
async function populateFilterDropdowns() {
    try {
        // Fetch tags (existing functionality)
        const tagsResponse = await fetch(`${API_BASE_URL}/tags`);
        if (!tagsResponse.ok) throw new Error(`Tags API error: ${tagsResponse.status}`);
        let tagsData = await tagsResponse.json();
        tagsData = tagsData.map(tag => (typeof tag === "object" && tag.name) ? tag.name : String(tag));
        tagFilterOptions.empty();
        tagFilterOptions.append('<li><a class="dropdown-item tag-filter-item" href="#" data-tag="">All Tags</a></li>');
        tagsData.forEach(tag => {
            const formattedTag = String(tag).charAt(0).toUpperCase() + String(tag).slice(1).toLowerCase();
            tagFilterOptions.append(`<li><a class="dropdown-item tag-filter-item" href="#" data-tag="${tag}">${formattedTag}</a></li>`);
        });

        // Fetch all recipes to extract meal types
        // Using limit=0 to fetch all recipes as per DummyJSON docs for other resources (assuming it works for recipes)
        // If limit=0 doesn't work as expected, we might need to paginate through all recipes.
        // For now, let's try with a high limit or what the API defaults to if limit=0 isn't supported for recipes.
        // The API documentation says "By default you will get 30 items, use Limit and skip to paginate through all items."
        // And "use limit=0 to get all items" for limit and skip section.
        const recipesResponse = await fetch(`${API_BASE_URL}?limit=0`); // Attempt to get all recipes
        if (!recipesResponse.ok) throw new Error(`Recipes API error for meal types: ${recipesResponse.status}`);
        const recipesData = await recipesResponse.json();

        let allMealTypes = new Set();
        if (recipesData && recipesData.recipes) {
            recipesData.recipes.forEach(recipe => {
                if (recipe.mealType && Array.isArray(recipe.mealType)) {
                    recipe.mealType.forEach(mt => allMealTypes.add(String(mt)));
                }
            });
        }

        const uniqueMealTypes = Array.from(allMealTypes).sort();

        mealTypeFilterOptions.empty();
        mealTypeFilterOptions.append('<li><a class="dropdown-item meal-type-filter-item" href="#" data-mealtype="">All Meal Types</a></li>');
        uniqueMealTypes.forEach(mealType => {
            mealTypeFilterOptions.append(`<li><a class="dropdown-item meal-type-filter-item" href="#" data-mealtype="${mealType}">${mealType}</a></li>`);
        });

    } catch (error) {
        console.error("Error populating filters:", error);
        showToast("Could not load filter options.", "danger");
    }
}
function resetActiveFiltersAndSearch(t=null){"search"!==t&&searchInput.val(""),"tag"!==t&&($("#tagFilterDropdown").text("Filter by Tag"),tagFilterOptions.find(".active").removeClass("active")),"mealType"!==t&&($("#mealTypeFilterDropdown").text("Filter by Meal Type"),mealTypeFilterOptions.find(".active").removeClass("active"))}function handleTagFilterClick(t){t.preventDefault();const e=$(this).data("tag");currentPage=1,resetActiveFiltersAndSearch("tag"),$("#tagFilterDropdown").text(e?`Tag: ${$(this).text()}`:"Filter by Tag"),tagFilterOptions.find(".dropdown-item.active").removeClass("active"),$(this).addClass("active"),e?(currentApiCallState={type:"tag",query:e,params:{limit:RECIPES_PER_PAGE,skip:0}},fetchFromAPI(`tag/${e}`,{limit:RECIPES_PER_PAGE,skip:0},"GET",null,!1,!1,!0)):fetchAllRecipes(0,RECIPES_PER_PAGE)}function handleMealTypeFilterClick(t){t.preventDefault();const e=$(this).data("mealtype");currentPage=1,resetActiveFiltersAndSearch("mealType"),$("#mealTypeFilterDropdown").text(e?`Type: ${$(this).text()}`:"Filter by Meal Type"),mealTypeFilterOptions.find(".dropdown-item.active").removeClass("active"),$(this).addClass("active"),e?(currentApiCallState={type:"mealType",query:e,params:{limit:RECIPES_PER_PAGE,skip:0}},fetchFromAPI(`meal-type/${e}`,{limit:RECIPES_PER_PAGE,skip:0},"GET",null,!1,!1,!0)):fetchAllRecipes(0,RECIPES_PER_PAGE)}

// --- Recipe Detail Functions --- (Minified)
async function displayRecipeDetails(t){const e=await fetchFromAPI(t,{},"GET",null,!1,!0,!1);if(!e)return recipeDetailModalBody.html('<p class="text-center text-danger">Could not load recipe details.</p>'),void recipeDetailModal.show();recipeDetailModalLabel.text(e.name);let a='<ul class="list-unstyled">';(e.ingredients||[]).forEach(t=>{a+=`<li><i class="bi bi-check-circle-fill text-success me-2"></i>${t}</li>`}),a+="</ul>";let i="<ol>";(e.instructions||[]).forEach(t=>{i+=`<li class="mb-2">${t}</li>`}),i+="</ol>";let l=(e.tags||[]).map(t=>`<span class="badge bg-secondary me-1 mb-1">${t}</span>`).join(""),s=(e.mealType||[]).map(t=>`<span class="badge bg-info me-1 mb-1">${t}</span>`).join("");recipeDetailModalBody.html(`\n        <div class="row">\n            <div class="col-md-5 text-center mb-3 mb-md-0"><img src="${e.image}" alt="${e.name}" class="img-fluid rounded shadow-sm" style="max-height: 300px; object-fit: cover;"></div>\n            <div class="col-md-7"><h4>${e.name}</h4>\n                <p class="mb-1"><strong><i class="bi bi-geo-alt-fill text-primary"></i> Cuisine:</strong> ${e.cuisine}</p>\n                <p class="mb-1"><strong><i class="bi bi-award-fill text-warning"></i> Difficulty:</strong> ${e.difficulty}</p>\n                <p class="mb-1"><strong><i class="bi bi-star-fill text-warning"></i> Rating:</strong> ${e.rating?e.rating.toFixed(1):"N/A"} (${e.reviewCount||0} reviews)</p>\n                <p class="mb-1"><strong><i class="bi bi-fire text-danger"></i> Calories:</strong> ${e.caloriesPerServing} per serving</p>\n                <p class="mb-1"><strong><i class="bi bi-clock-fill text-info"></i> Prep Time:</strong> ${e.prepTimeMinutes} min</p>\n                <p class="mb-1"><strong><i class="bi bi-stopwatch-fill text-info"></i> Cook Time:</strong> ${e.cookTimeMinutes} min</p>\n                <p class="mb-1"><strong><i class="bi bi-people-fill text-secondary"></i> Servings:</strong> ${e.servings}</p></div></div><hr>\n        <h5><i class="bi bi-list-ul text-primary"></i> Ingredients</h5>${a}<hr>\n        <h5><i class="bi bi-card-checklist text-primary"></i> Instructions</h5>${i}<hr>\n        ${l?`<h6><i class="bi bi-tags-fill text-secondary"></i> Tags</h6><p>${l}</p>`:""}\n        ${s?`<h6><i class="bi bi-pie-chart-fill text-info"></i> Meal Types</h6><p>${s}</p>`:""}`),recipeDetailModalElement.dataset.recipeId=e.id,editRecipeModalBtn.data("id",e.id),deleteRecipeModalBtn.data("id",e.id),recipeDetailModal.show()}function handleViewRecipeClick(){$(this).data("id")&&displayRecipeDetails($(this).data("id"))}

// --- Pagination Functions --- (Minified)
function updatePagination(){paginationControls.empty();const t=Math.ceil(totalRecipes/RECIPES_PER_PAGE);if(t<=1)return void paginationControls.addClass("d-none");paginationControls.removeClass("d-none"),paginationControls.append(`<li class="page-item ${1===currentPage?"disabled":""}"><a class="page-link" href="#" data-page="${currentPage-1}" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a></li>`);const e=5;let a=Math.max(1,currentPage-Math.floor(e/2)),i=Math.min(t,a+e-1);if(i-a+1<e&&(currentPage<t/2?i=Math.min(t,a+e-1):a=Math.max(1,i-e+1)),i-a+1>e&&(currentPage>t/2?a=i-e+1:i=a+e-1),a=Math.max(1,a),i=Math.min(t,i),a>1&&(paginationControls.append('<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>'),a>2&&paginationControls.append('<li class="page-item disabled"><span class="page-link">...</span></li>')),i>=a)for(let n=a;n<=i;n++)paginationControls.append(`<li class="page-item ${n===currentPage?"active":""}" ${n===currentPage?'aria-current="page"':""}><a class="page-link" href="#" data-page="${n}">${n}</a></li>`);i<t&&(i<t-1&&paginationControls.append('<li class="page-item disabled"><span class="page-link">...</span></li>'),paginationControls.append(`<li class="page-item"><a class="page-link" href="#" data-page="${t}">${t}</a></li>`)),paginationControls.append(`<li class="page-item ${currentPage===t?"disabled":""}"><a class="page-link" href="#" data-page="${currentPage+1}" aria-label="Next"><span aria-hidden="true">&raquo;</span></a></li>`)}function handlePageClick(t){t.preventDefault();const e=$(this);if(!e.is("a.page-link")||e.closest(".page-item").hasClass("disabled"))return;const a=parseInt(e.data("page")),i=Math.ceil(totalRecipes/RECIPES_PER_PAGE);if(!(isNaN(a)||a<1||a>i&&i>0&&"tag"!==currentApiCallState.type&&"mealType"!==currentApiCallState.type)||!("tag"!==currentApiCallState.type&&"mealType"!==currentApiCallState.type||!(a>0)))if(a!==currentPage){currentPage=a;const n=(currentPage-1)*RECIPES_PER_PAGE,{type:r,query:o,params:c}=currentApiCallState;"search"===r&&o?fetchFromAPI(API_BASE_URL+"/search",{q:o,limit:RECIPES_PER_PAGE,skip:n},"GET",null,!0,!1,!1):"tag"===r&&o?fetchFromAPI(`tag/${o}`,{limit:RECIPES_PER_PAGE,skip:n},"GET",null,!1,!1,!0):"mealType"===r&&o?fetchFromAPI(`meal-type/${o}`,{limit:RECIPES_PER_PAGE,skip:n},"GET",null,!1,!1,!0):fetchAllRecipes(n,RECIPES_PER_PAGE)}}

// State to keep track of the current type of API call for pagination
let currentApiCallState = { type: 'all', query: null, params: {} };

// --- Sorting Functions --- (Minified)
function handleSortChange() { currentPage = 1; resetActiveFiltersAndSearch(); fetchAllRecipes(0, RECIPES_PER_PAGE); }

// --- Add/Edit/Delete Recipe Functions ---
function prepareAddRecipeModal() {
    addEditRecipeModalLabel.text('Add New Recipe');
    addEditRecipeForm[0].reset();
    $('#recipeId').val('');
    addEditRecipeForm.removeClass('was-validated');
}

async function handleEditRecipeClick() {
    const recipeId = $(this).data('id') || recipeDetailModalElement.dataset.recipeId;
    if (!recipeId) { showToast("Could not find recipe ID to edit.", "danger"); return; }
    const recipeToEdit = await fetchFromAPI(recipeId, {}, 'GET', null, false, true, false);
    if (recipeToEdit) {
        addEditRecipeModalLabel.text(`Edit Recipe: ${recipeToEdit.name}`);
        $('#recipeId').val(recipeToEdit.id);
        $('#recipeName').val(recipeToEdit.name);
        $('#recipeIngredients').val((recipeToEdit.ingredients || []).join(', '));
        $('#recipeInstructions').val((recipeToEdit.instructions || []).join('; '));
        $('#recipeImage').val(recipeToEdit.image);
        $('#recipePrepTime').val(recipeToEdit.prepTimeMinutes);
        $('#recipeCookTime').val(recipeToEdit.cookTimeMinutes);
        $('#recipeCuisine').val(recipeToEdit.cuisine);
        $('#recipeDifficulty').val(recipeToEdit.difficulty);
        $('#recipeTags').val((recipeToEdit.tags || []).join(', '));
        $('#recipeMealType').val((recipeToEdit.mealType || []).join(', '));
        addEditRecipeForm.removeClass('was-validated');
        recipeDetailModal.hide();
        addEditRecipeModal.show();
    } else { showToast("Could not load recipe data for editing.", "danger"); }
}

async function handleAddEditRecipeSubmit(event) {
    event.preventDefault();
    const recipeId = $('#recipeId').val();
    const isEditMode = !!recipeId;

    if (!addEditRecipeForm[0].checkValidity()) {
        event.stopPropagation(); addEditRecipeForm.addClass('was-validated');
        showToast("Please fill all required fields correctly.", "danger"); return;
    }
    addEditRecipeForm.removeClass('was-validated');

    const recipeData = {
        name: $('#recipeName').val(),
        ingredients: $('#recipeIngredients').val().split(',').map(item => item.trim()).filter(item => item),
        instructions: $('#recipeInstructions').val().split(';').map(item => item.trim()).filter(item => item),
        image: $('#recipeImage').val() || 'https://dummyimage.com/600x400/ced4da/6c757d.jpg&text=No+Image',
        prepTimeMinutes: parseInt($('#recipePrepTime').val()) || 0,
        cookTimeMinutes: parseInt($('#recipeCookTime').val()) || 0,
        cuisine: $('#recipeCuisine').val() || 'Unknown',
        difficulty: $('#recipeDifficulty').val() || 'Medium',
        tags: $('#recipeTags').val().split(',').map(item => item.trim()).filter(item => item),
        mealType: $('#recipeMealType').val().split(',').map(item => item.trim()).filter(item => item),
    };
    if (!isEditMode) {
        recipeData.userId = 5; recipeData.caloriesPerServing = Math.floor(Math.random() * 500) + 100;
        recipeData.rating = parseFloat((Math.random() * 4 + 1).toFixed(1));
        recipeData.reviewCount = Math.floor(Math.random() * 100);
    }

    let result;
    if (isEditMode) { result = await fetchFromAPI(recipeId, {}, 'PUT', recipeData, false, true, false); }
    else { result = await fetchFromAPI('add', {}, 'POST', recipeData, false, false, false); }

    if (result && result.id) {
        showToast(`Recipe ${isEditMode ? 'updated' : 'added'} successfully! (ID: ${result.id})`, 'success');
        addEditRecipeModal.hide(); addEditRecipeForm[0].reset();
        if (isEditMode) { $(`.recipe-card-col[data-recipe-id="${result.id}"]`).replaceWith(createRecipeCard(result)); }
        else { recipeCardGrid.prepend(createRecipeCard(result)); totalRecipes++; updatePagination(); }
    } else { showToast(`Failed to ${isEditMode ? 'update' : 'add'} recipe. ${result ? result.message : 'Unknown error.'}`, 'danger'); }
}

async function handleDeleteRecipeClick() {
    const recipeId = $(this).data('id') || recipeDetailModalElement.dataset.recipeId;
    if (!recipeId) { showToast("Could not find recipe ID to delete.", "danger"); return; }

    // Simple confirmation for deletion
    if (!confirm('Are you sure you want to delete this recipe? This action is simulated.')) {
        return;
    }

    const result = await fetchFromAPI(recipeId, {}, 'DELETE', null, false, true, false);

    if (result && result.isDeleted) { // Check our custom isDeleted flag
        showToast(`Recipe "${result.name || `ID: ${recipeId}`}" deleted successfully! (Simulated)`, 'success');
        recipeDetailModal.hide(); // Hide if open
        // Remove card from grid
        $(`.recipe-card-col[data-recipe-id="${recipeId}"]`).remove();
        totalRecipes--;
        updatePagination();
        // If current page becomes empty after deletion, try to go to previous page or first page
        if (recipeCardGrid.children().length === 0 && currentPage > 1) {
            currentPage--;
        }
        // Potentially re-fetch if on an empty page to ensure data consistency, or if last item on page deleted.
        // For simplicity, if after deletion the current view is empty, fetch current page again.
        // This might re-fetch the same page if totalRecipes was correctly updated by API,
        // or go to prev page if logic above moved currentPage.
        if (recipeCardGrid.children().length === 0 && totalRecipes > 0) {
             fetchAllRecipes((currentPage - 1) * RECIPES_PER_PAGE, RECIPES_PER_PAGE);
        } else if (totalRecipes === 0) { // No recipes left
            displayRecipes([]); // Explicitly show "no recipes" message
        }

    } else {
        showToast(`Failed to delete recipe. ${result ? result.message : 'Simulation error or API did not confirm deletion.'}`, 'danger');
    }
}


// --- Initialization ---
$(document).ready(function() {
    console.log("Script loaded and DOM ready!");

    populateFilterDropdowns();
    fetchAllRecipes();

    // Event Listeners
    searchForm.on('submit', function(event) {
        event.preventDefault(); currentPage = 1;
        const searchTerm = searchInput.val().trim();
        resetActiveFiltersAndSearch('search');
        if (searchTerm) {
            currentApiCallState = { type: 'search', query: searchTerm, params: {} };
            fetchFromAPI(API_BASE_URL + '/search', { q: searchTerm, limit: RECIPES_PER_PAGE, skip: 0 }, 'GET', null, true, false, false);
        } else { fetchAllRecipes(0, RECIPES_PER_PAGE); }
    });

    tagFilterOptions.on('click', '.tag-filter-item', handleTagFilterClick);
    mealTypeFilterOptions.on('click', '.meal-type-filter-item', handleMealTypeFilterClick);
    sortBySelect.on('change', handleSortChange);
    sortOrderSelect.on('change', handleSortChange);
    paginationControls.on('click', 'a.page-link', handlePageClick);
    recipeCardGrid.on('click', '.view-recipe-btn', handleViewRecipeClick);

    addRecipeBtn.on('click', prepareAddRecipeModal);
    addEditRecipeForm.on('submit', handleAddEditRecipeSubmit);
    editRecipeModalBtn.on('click', handleEditRecipeClick);
    deleteRecipeModalBtn.on('click', handleDeleteRecipeClick);
});
