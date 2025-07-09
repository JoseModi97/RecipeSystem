// Global variables
const API_BASE_URL = 'https://dummyjson.com/recipes';
const RECIPES_PER_PAGE = 30;
const SKELETON_CARDS_COUNT = 9; // Number of skeleton cards for initial load
const SKELETON_CARDS_COUNT_MORE = 3; // Number of skeleton cards for "load more"
let currentPage = 1;
let totalRecipes = 0;
let currentRecipes = []; // To store all fetched recipes
let isLoadingMore = false; // Flag to prevent multiple fetches during infinite scroll
let currentApiCallType = 'all'; // 'all', 'search', 'tag', 'mealType'
let currentApiQuery = null; // Stores search term or filter value

// DOM Elements
const recipeCardGrid = $('#recipeCardGrid');
// const paginationControls = $('#paginationControls'); // To be removed
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
    // paginationControls.addClass("d-none"); // Pagination will be removed
}

function showMoreLoader() {
    for (let i = 0; i < SKELETON_CARDS_COUNT_MORE; i++) {
        recipeCardGrid.append(createSkeletonCard());
    }
}

function hideMoreLoader() {
    // Remove only the "load more" skeleton cards
    recipeCardGrid.find('.skeleton-card').slice(-SKELETON_CARDS_COUNT_MORE).remove();
}


function hideLoader() {
    // Skeleton cards are removed by displayRecipes or explicit clear, so this function is now a no-op
    // for the main skeleton batch.
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
    // If currentPage is 1, it means it's an initial load (or search/filter reset), so clear the grid.
    // Otherwise, it's infinite scroll, so append.
    if (currentPage === 1) {
        recipeCardGrid.empty(); // This will clear skeleton cards or previous recipes
    }

    if ((!recipes || recipes.length === 0) && currentPage === 1) {
        recipeCardGrid.html('<div class="col-12"><p class="text-center mt-5">No recipes found.</p></div>');
        totalRecipes = 0; // Ensure totalRecipes is updated for "no results"
    } else if (recipes && recipes.length > 0) {
        recipes.forEach(recipe => { recipeCardGrid.append(createRecipeCard(recipe)); });
    } else if (currentPage > 1 && (!recipes || recipes.length === 0)) {
        // No more recipes to load for infinite scroll
        recipeCardGrid.append('<div class="col-12 text-center my-3" id="noMoreRecipesMessage"><p>No more recipes to load.</p></div>');
        // Potentially disable further scroll listening if this message is shown
    }
    // updatePagination(); // To be removed
}

// --- API Fetching Functions ---
async function fetchFromAPI(endpoint, queryParams = {}, method = 'GET', body = null, isSearch = false, isSingleRecipe = false, isFilter = false, isLoadMore = false) {
    if (isLoadingMore && isLoadMore) return; // Prevent multiple simultaneous "load more" calls

    if (isLoadMore) {
        isLoadingMore = true;
        showMoreLoader(); // Show skeletons at the bottom
    } else if (!isSingleRecipe && method === 'GET' && (endpoint === API_BASE_URL || endpoint.startsWith('tag/') || endpoint.startsWith('meal-type/') || isSearch)) {
        // This is an initial load (or search/filter)
        currentPage = 1; // Reset page for new data set
        $('#noMoreRecipesMessage').remove(); // Remove any "no more recipes" message
        showLoader(); // Clear grid and show full skeleton set
    }
    // For single recipe fetch (view details, edit prep), we don't use grid skeleton loaders.
    // Add/Edit/Delete operations also don't need grid skeletons.


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
        if (isLoadMore) {
            hideMoreLoader();
        }
        if (!isSingleRecipe && method === 'GET' && method !== 'DELETE') {
            recipeCardGrid.html('<div class="col-12"><p class="text-center text-danger mt-5">Could not load recipes.</p></div>');
            totalRecipes = 0;
            // updatePagination(); // To be removed
        }
        return null;
    } finally {
        if (isLoadMore) {
            isLoadingMore = false;
            hideMoreLoader(); // Ensure skeletons are removed even if fetch failed or returned empty
        }
        // General hideLoader() for initial load is handled by displayRecipes replacing content.
    }
}

function fetchAllRecipes(isLoadMore = false) {
    const skip = isLoadMore ? currentPage * RECIPES_PER_PAGE : 0;
    if (isLoadMore && (skip >= totalRecipes && totalRecipes > 0)) {
        recipeCardGrid.append('<div class="col-12 text-center my-3" id="noMoreRecipesMessage"><p>No more recipes to load.</p></div>');
        isLoadingMore = false; // Reset flag
        hideMoreLoader(); // Ensure any stray loaders are gone
        return; // No more recipes to fetch
    }
    if (!isLoadMore) { // Initial load or sort change
        currentPage = 1;
        currentApiCallType = 'all';
        currentApiQuery = null;
        $('#noMoreRecipesMessage').remove();
    }
    const queryParams = { limit: RECIPES_PER_PAGE, skip: skip, sortBy: sortBySelect.val(), order: sortOrderSelect.val() };
    fetchFromAPI(API_BASE_URL, queryParams, 'GET', null, false, false, false, isLoadMore);
}

// --- Filter Functions ---
async function populateFilterDropdowns() {
    try {
        const tagsResponse = await fetch(`${API_BASE_URL}/tags`);
        if (!tagsResponse.ok) throw new Error(`Tags API error: ${tagsResponse.status}`);
        let tagsData = await tagsResponse.json();
        tagsData = tagsData.map(tag => (typeof tag === "object" && tag.name) ? tag.name : String(tag));
        tagFilterOptions.empty().append('<li><a class="dropdown-item tag-filter-item" href="#" data-tag="">All Tags</a></li>');
        tagsData.forEach(tag => {
            const formattedTag = String(tag).charAt(0).toUpperCase() + String(tag).slice(1).toLowerCase();
            tagFilterOptions.append(`<li><a class="dropdown-item tag-filter-item" href="#" data-tag="${tag}">${formattedTag}</a></li>`);
        });

        const recipesResponse = await fetch(`${API_BASE_URL}?limit=0`);
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
        mealTypeFilterOptions.empty().append('<li><a class="dropdown-item meal-type-filter-item" href="#" data-mealtype="">All Meal Types</a></li>');
        uniqueMealTypes.forEach(mealType => {
            mealTypeFilterOptions.append(`<li><a class="dropdown-item meal-type-filter-item" href="#" data-mealtype="${mealType}">${mealType}</a></li>`);
        });
    } catch (error) {
        console.error("Error populating filters:", error);
        showToast("Could not load filter options.", "danger");
    }
}

function resetActiveFiltersAndSearch(type = null) {
    if (type !== 'search') searchInput.val('');
    if (type !== 'tag') {
        $("#tagFilterDropdown").text("Filter by Tag");
        tagFilterOptions.find(".active").removeClass("active");
    }
    if (type !== 'mealType') {
        $("#mealTypeFilterDropdown").text("Filter by Meal Type");
        mealTypeFilterOptions.find(".active").removeClass("active");
    }
}

function handleTagFilterClick(event) {
    event.preventDefault();
    const tag = $(this).data("tag");
    resetActiveFiltersAndSearch('tag');
    $("#tagFilterDropdown").text(tag ? `Tag: ${$(this).text()}` : "Filter by Tag");
    tagFilterOptions.find(".dropdown-item.active").removeClass("active");
    $(this).addClass("active");

    currentApiCallType = tag ? 'tag' : 'all';
    currentApiQuery = tag;
    currentPage = 1; // Reset for new filter
    $('#noMoreRecipesMessage').remove();
    const skip = 0;
    const endpoint = tag ? `tag/${tag}` : API_BASE_URL;
    fetchFromAPI(endpoint, { limit: RECIPES_PER_PAGE, skip: skip }, "GET", null, false, false, !!tag, false);
}

function handleMealTypeFilterClick(event) {
    event.preventDefault();
    const mealType = $(this).data("mealtype");
    resetActiveFiltersAndSearch('mealType');
    $("#mealTypeFilterDropdown").text(mealType ? `Type: ${$(this).text()}` : "Filter by Meal Type");
    mealTypeFilterOptions.find(".dropdown-item.active").removeClass("active");
    $(this).addClass("active");

    currentApiCallType = mealType ? 'mealType' : 'all';
    currentApiQuery = mealType;
    currentPage = 1; // Reset for new filter
    $('#noMoreRecipesMessage').remove();
    const skip = 0;
    const endpoint = mealType ? `meal-type/${mealType}` : API_BASE_URL;
    fetchFromAPI(endpoint, { limit: RECIPES_PER_PAGE, skip: skip }, "GET", null, false, false, !!mealType, false);
}


// --- Recipe Detail Functions --- (Minified)
async function displayRecipeDetails(t){const e=await fetchFromAPI(t,{},"GET",null,!1,!0,!1);if(!e)return recipeDetailModalBody.html('<p class="text-center text-danger">Could not load recipe details.</p>'),void recipeDetailModal.show();recipeDetailModalLabel.text(e.name);let a='<ul class="list-unstyled">';(e.ingredients||[]).forEach(t=>{a+=`<li><i class="bi bi-check-circle-fill text-success me-2"></i>${t}</li>`}),a+="</ul>";let i="<ol>";(e.instructions||[]).forEach(t=>{i+=`<li class="mb-2">${t}</li>`}),i+="</ol>";let l=(e.tags||[]).map(t=>`<span class="badge bg-secondary me-1 mb-1">${t}</span>`).join(""),s=(e.mealType||[]).map(t=>`<span class="badge bg-info me-1 mb-1">${t}</span>`).join("");recipeDetailModalBody.html(`\n        <div class="row">\n            <div class="col-md-5 text-center mb-3 mb-md-0"><img src="${e.image}" alt="${e.name}" class="img-fluid rounded shadow-sm" style="max-height: 300px; object-fit: cover;"></div>\n            <div class="col-md-7"><h4>${e.name}</h4>\n                <p class="mb-1"><strong><i class="bi bi-geo-alt-fill text-primary"></i> Cuisine:</strong> ${e.cuisine}</p>\n                <p class="mb-1"><strong><i class="bi bi-award-fill text-warning"></i> Difficulty:</strong> ${e.difficulty}</p>\n                <p class="mb-1"><strong><i class="bi bi-star-fill text-warning"></i> Rating:</strong> ${e.rating?e.rating.toFixed(1):"N/A"} (${e.reviewCount||0} reviews)</p>\n                <p class="mb-1"><strong><i class="bi bi-fire text-danger"></i> Calories:</strong> ${e.caloriesPerServing} per serving</p>\n                <p class="mb-1"><strong><i class="bi bi-clock-fill text-info"></i> Prep Time:</strong> ${e.prepTimeMinutes} min</p>\n                <p class="mb-1"><strong><i class="bi bi-stopwatch-fill text-info"></i> Cook Time:</strong> ${e.cookTimeMinutes} min</p>\n                <p class="mb-1"><strong><i class="bi bi-people-fill text-secondary"></i> Servings:</strong> ${e.servings}</p></div></div><hr>\n        <h5><i class="bi bi-list-ul text-primary"></i> Ingredients</h5>${a}<hr>\n        <h5><i class="bi bi-card-checklist text-primary"></i> Instructions</h5>${i}<hr>\n        ${l?`<h6><i class="bi bi-tags-fill text-secondary"></i> Tags</h6><p>${l}</p>`:""}\n        ${s?`<h6><i class="bi bi-pie-chart-fill text-info"></i> Meal Types</h6><p>${s}</p>`:""}`),recipeDetailModalElement.dataset.recipeId=e.id,editRecipeModalBtn.data("id",e.id),deleteRecipeModalBtn.data("id",e.id),recipeDetailModal.show()}function handleViewRecipeClick(){$(this).data("id")&&displayRecipeDetails($(this).data("id"))}

// --- Pagination Functions --- (Minified)
// function updatePagination(){paginationControls.empty();const t=Math.ceil(totalRecipes/RECIPES_PER_PAGE);if(t<=1)return void paginationControls.addClass("d-none");paginationControls.removeClass("d-none"),paginationControls.append(`<li class="page-item ${1===currentPage?"disabled":""}"><a class="page-link" href="#" data-page="${currentPage-1}" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a></li>`);const e=5;let a=Math.max(1,currentPage-Math.floor(e/2)),i=Math.min(t,a+e-1);if(i-a+1<e&&(currentPage<t/2?i=Math.min(t,a+e-1):a=Math.max(1,i-e+1)),i-a+1>e&&(currentPage>t/2?a=i-e+1:i=a+e-1),a=Math.max(1,a),i=Math.min(t,i),a>1&&(paginationControls.append('<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>'),a>2&&paginationControls.append('<li class="page-item disabled"><span class="page-link">...</span></li>')),i>=a)for(let n=a;n<=i;n++)paginationControls.append(`<li class="page-item ${n===currentPage?"active":""}" ${n===currentPage?'aria-current="page"':""}><a class="page-link" href="#" data-page="${n}">${n}</a></li>`);i<t&&(i<t-1&&paginationControls.append('<li class="page-item disabled"><span class="page-link">...</span></li>'),paginationControls.append(`<li class="page-item"><a class="page-link" href="#" data-page="${t}">${t}</a></li>`)),paginationControls.append(`<li class="page-item ${currentPage===t?"disabled":""}"><a class="page-link" href="#" data-page="${currentPage+1}" aria-label="Next"><span aria-hidden="true">&raquo;</span></a></li>`)}function handlePageClick(t){t.preventDefault();const e=$(this);if(!e.is("a.page-link")||e.closest(".page-item").hasClass("disabled"))return;const a=parseInt(e.data("page")),i=Math.ceil(totalRecipes/RECIPES_PER_PAGE);if(!(isNaN(a)||a<1||a>i&&i>0&&"tag"!==currentApiCallState.type&&"mealType"!==currentApiCallState.type)||!("tag"!==currentApiCallState.type&&"mealType"!==currentApiCallState.type||!(a>0)))if(a!==currentPage){currentPage=a;const n=(currentPage-1)*RECIPES_PER_PAGE,{type:r,query:o,params:c}=currentApiCallState;"search"===r&&o?fetchFromAPI(API_BASE_URL+"/search",{q:o,limit:RECIPES_PER_PAGE,skip:n},"GET",null,!0,!1,!1):"tag"===r&&o?fetchFromAPI(`tag/${o}`,{limit:RECIPES_PER_PAGE,skip:n},"GET",null,!1,!1,!0):"mealType"===r&&o?fetchFromAPI(`meal-type/${o}`,{limit:RECIPES_PER_PAGE,skip:n},"GET",null,!1,!1,!0):fetchAllRecipes(n,RECIPES_PER_PAGE)}}
// Pagination functions (updatePagination, handlePageClick) are no longer needed and will be removed.

// State to keep track of the current type of API call for pagination - Replaced by currentApiCallType and currentApiQuery
// let currentApiCallState = { type: 'all', query: null, params: {} };

// --- Sorting Functions ---
function handleSortChange() {
    // No need to reset filters here as sorting applies to the current filtered view or all recipes
    fetchAllRecipes(false); // false indicates it's not a "load more" call, so it resets to page 1
}

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
        if (isEditMode) { result = await fetchFromAPI(recipeId, {}, 'PUT', recipeData, false, true, false, false); }
        else { result = await fetchFromAPI('add', {}, 'POST', recipeData, false, false, false, false); }

    if (result && result.id) {
        showToast(`Recipe ${isEditMode ? 'updated' : 'added'} successfully! (ID: ${result.id})`, 'success');
        addEditRecipeModal.hide(); addEditRecipeForm[0].reset();
            // For simplicity, we'll just refetch all recipes to see the new/updated one.
            // A more sophisticated approach might involve inserting/updating the card directly.
            fetchAllRecipes(false); // false indicates not a "load more", so it resets and fetches page 1
    } else { showToast(`Failed to ${isEditMode ? 'update' : 'add'} recipe. ${result ? result.message : 'Unknown error.'}`, 'danger'); }
}

async function handleDeleteRecipeClick() {
    const recipeId = $(this).data('id') || recipeDetailModalElement.dataset.recipeId;
    if (!recipeId) { showToast("Could not find recipe ID to delete.", "danger"); return; }

        if (!confirm('Are you sure you want to delete this recipe? This action is simulated.')) return;

        const result = await fetchFromAPI(recipeId, {}, 'DELETE', null, false, true, false, false);

        if (result && result.isDeleted) {
        showToast(`Recipe "${result.name || `ID: ${recipeId}`}" deleted successfully! (Simulated)`, 'success');
            recipeDetailModal.hide();
            // Remove card from grid directly
        $(`.recipe-card-col[data-recipe-id="${recipeId}"]`).remove();
            totalRecipes--; // Adjust total recipes
            // If the grid becomes empty, show "No recipes" message
            if (recipeCardGrid.children(':not(#noMoreRecipesMessage)').length === 0) {
                displayRecipes([]); // This will show "No recipes found"
        }
    } else {
        showToast(`Failed to delete recipe. ${result ? result.message : 'Simulation error or API did not confirm deletion.'}`, 'danger');
    }
}

    // --- Infinite Scroll ---
    function handleScroll() {
        // Check if user is near the bottom of the page
        // (window height + scrollY) >= (document height - threshold)
        // And not already loading, and there might be more recipes
        const threshold = 300; // Pixels from bottom
        if (
            (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - threshold) &&
            !isLoadingMore &&
            (currentPage * RECIPES_PER_PAGE < totalRecipes || totalRecipes === 0 && currentPage ===1 ) && // totalRecipes might be 0 initially if first fetch failed or is in progress
            !$('#noMoreRecipesMessage').length // Don't fetch if "no more" message is shown
        ) {
            console.log("Near bottom, loading more...");
            currentPage++;
            const skip = (currentPage -1) * RECIPES_PER_PAGE;

            let endpoint = API_BASE_URL;
            let queryParams = { limit: RECIPES_PER_PAGE, skip: skip, sortBy: sortBySelect.val(), order: sortOrderSelect.val() };
            let isSearchFlag = false;
            let isFilterFlag = false;

            if (currentApiCallType === 'search' && currentApiQuery) {
                endpoint = `${API_BASE_URL}/search`;
                queryParams.q = currentApiQuery;
                isSearchFlag = true;
            } else if (currentApiCallType === 'tag' && currentApiQuery) {
                endpoint = `tag/${currentApiQuery}`;
                isFilterFlag = true;
            } else if (currentApiCallType === 'mealType' && currentApiQuery) {
                endpoint = `meal-type/${currentApiQuery}`;
                isFilterFlag = true;
            }
            // else it's 'all' - endpoint and queryParams are already set for this by default

            fetchFromAPI(endpoint, queryParams, 'GET', null, isSearchFlag, false, isFilterFlag, true);
        }
    }


// --- Initialization ---
$(document).ready(function() {
    console.log("Script loaded and DOM ready!");

    populateFilterDropdowns();
        fetchAllRecipes(false); // Initial fetch (not load more)

    // Event Listeners
    searchForm.on('submit', function(event) {
            event.preventDefault();
        const searchTerm = searchInput.val().trim();
        resetActiveFiltersAndSearch('search');
            currentApiCallType = searchTerm ? 'search' : 'all';
            currentApiQuery = searchTerm;
            currentPage = 1; // Reset page for new search
             $('#noMoreRecipesMessage').remove();


        if (searchTerm) {
                fetchFromAPI(`${API_BASE_URL}/search`, { q: searchTerm, limit: RECIPES_PER_PAGE, skip: 0 }, 'GET', null, true, false, false, false);
            } else {
                fetchAllRecipes(false); // Fetch all if search is cleared
            }
    });

    tagFilterOptions.on('click', '.tag-filter-item', handleTagFilterClick);
    mealTypeFilterOptions.on('click', '.meal-type-filter-item', handleMealTypeFilterClick);
    sortBySelect.on('change', handleSortChange);
    sortOrderSelect.on('change', handleSortChange);
        // paginationControls.on('click', 'a.page-link', handlePageClick); // Removed
    recipeCardGrid.on('click', '.view-recipe-btn', handleViewRecipeClick);

    addRecipeBtn.on('click', prepareAddRecipeModal);
    addEditRecipeForm.on('submit', handleAddEditRecipeSubmit);
    editRecipeModalBtn.on('click', handleEditRecipeClick);
    deleteRecipeModalBtn.on('click', handleDeleteRecipeClick);

        $(window).on('scroll', handleScroll); // Add scroll listener
});
