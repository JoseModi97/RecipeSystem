// Global variables
const API_BASE_URL = 'https://dummyjson.com/recipes';
const RECIPES_PER_PAGE = 30;
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
// const recipeDetailModal = new bootstrap.Modal(recipeDetailModalElement); // UIkit handles this via attributes or JS
const recipeDetailModalBody = $('#recipeDetailModalBody');
const recipeDetailModalLabel = $('#recipeDetailModalLabel');
const addEditRecipeModalElement = document.getElementById('addEditRecipeModal');
// const addEditRecipeModal = new bootstrap.Modal(addEditRecipeModalElement); // UIkit handles this via attributes or JS
const addEditRecipeForm = $('#addEditRecipeForm');
const addEditRecipeModalLabel = $('#addEditRecipeModalLabel');
const addRecipeBtn = $('#addRecipeBtn');
const editRecipeModalBtn = $('#editRecipeModalBtn');
const deleteRecipeModalBtn = $('#deleteRecipeModalBtn');
// const loadingSpinnerModal = new bootstrap.Modal(document.getElementById('loadingSpinnerModal')); // UIkit handles this
const loadingSpinnerModalElement = document.getElementById('loadingSpinnerModal');

// Utility Functions
function showLoader() { UIkit.modal(loadingSpinnerModalElement).show(); }
function hideLoader() { setTimeout(() => { UIkit.modal(loadingSpinnerModalElement).hide(); }, 250); }

function showToast(message, type = 'success') {
    let statusClass = 'uk-alert-primary';
    if (type === 'success') statusClass = 'uk-alert-success';
    else if (type === 'danger') statusClass = 'uk-alert-danger';
    else if (type === 'warning') statusClass = 'uk-alert-warning';

    UIkit.notification({
        message: message,
        status: type, // 'primary', 'success', 'warning', 'danger'
        pos: 'top-right',
        timeout: 5000
    });
}

// --- Recipe Display Functions ---
function createRecipeCard(recipe) {
    // Using UIkit card classes
    return `
    <div data-recipe-id="${recipe.id}">
        <div class="uk-card uk-card-default uk-card-hover uk-height-1-1 uk-box-shadow-small">
            <div class="uk-card-media-top">
                <img src="${recipe.image}" alt="${recipe.name}" style="height: 200px; width:100%; object-fit: cover;" loading="lazy">
            </div>
            <div class="uk-card-body uk-flex uk-flex-column">
                <h3 class="uk-card-title uk-margin-remove-bottom">${recipe.name}</h3>
                <p class="uk-text-small uk-margin-small-top uk-margin-remove-bottom">Cuisine: ${recipe.cuisine}</p>
                <p class="uk-text-small uk-margin-small-top uk-margin-remove-bottom">Difficulty: ${recipe.difficulty}</p>
                <p class="uk-text-small uk-margin-small-top uk-margin-remove-bottom">Rating: ${recipe.rating ? recipe.rating.toFixed(1) : 'N/A'} <span uk-icon="icon: star; ratio: 0.8" class="uk-text-warning"></span> (${recipe.reviewCount || 0} reviews)</p>
                <p class="uk-text-small uk-margin-small-top">Calories: ${recipe.caloriesPerServing}</p>
                <div class="uk-margin-auto-top">
                    <button class="uk-button uk-button-primary uk-width-1-1 view-recipe-btn" data-id="${recipe.id}">View Recipe</button>
                </div>
            </div>
        </div>
    </div>`;
}
function displayRecipes(recipes) {
    recipeCardGrid.empty();
    if (!recipes || recipes.length === 0) { recipeCardGrid.html('<div class="uk-width-1-1"><p class="uk-text-center uk-margin-large-top">No recipes found.</p></div>'); totalRecipes = 0; }
    else { recipes.forEach(recipe => { recipeCardGrid.append(createRecipeCard(recipe)); }); }
    updatePagination();
}

// --- API Fetching Functions ---
async function fetchFromAPI(endpoint, queryParams = {}, method = 'GET', body = null, isSearch = false, isSingleRecipe = false, isFilter = false) {
    showLoader();
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
        if (!isSingleRecipe && method === 'GET' && method !== 'DELETE') { recipeCardGrid.html('<div class="uk-width-1-1"><p class="uk-text-center uk-text-danger uk-margin-large-top">Could not load recipes.</p></div>'); totalRecipes = 0; displayRecipes([]); }
        return null;
    } finally { hideLoader(); }
}
function fetchAllRecipes(skip = 0, limit = RECIPES_PER_PAGE) {
    const queryParams = { limit: limit, skip: skip, sortBy: sortBySelect.val(), order: sortOrderSelect.val() };
    currentApiCallState = { type: 'all', query: null, params: queryParams };
    fetchFromAPI(API_BASE_URL, queryParams);
}

// --- Filter Functions ---
async function populateFilterDropdowns() {
    try {
        // Fetch tags (existing functionality)
        const tagsResponse = await fetch(`${API_BASE_URL}/tags`);
        if (!tagsResponse.ok) throw new Error(`Tags API error: ${tagsResponse.status}`);
        let tagsData = await tagsResponse.json();
        tagsData = tagsData.map(tag => (typeof tag === "object" && tag.name) ? tag.name : String(tag));
        tagFilterOptions.empty();
        $('#tagFilterOptionsMobile').empty(); // For off-canvas
        const allTagsLink = '<li><a class="tag-filter-item" href="#" data-tag="">All Tags</a></li>';
        tagFilterOptions.append(allTagsLink);
        $('#tagFilterOptionsMobile').append(allTagsLink);
        tagsData.forEach(tag => {
            const formattedTag = String(tag).charAt(0).toUpperCase() + String(tag).slice(1).toLowerCase();
            const tagLink = `<li><a class="tag-filter-item" href="#" data-tag="${tag}">${formattedTag}</a></li>`;
            tagFilterOptions.append(tagLink);
            $('#tagFilterOptionsMobile').append(tagLink);
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
        $('#mealTypeFilterOptionsMobile').empty(); // For off-canvas
        const allMealTypesLink = '<li><a class="meal-type-filter-item" href="#" data-mealtype="">All Meal Types</a></li>';
        mealTypeFilterOptions.append(allMealTypesLink);
        $('#mealTypeFilterOptionsMobile').append(allMealTypesLink);
        uniqueMealTypes.forEach(mealType => {
            const mealTypeLink = `<li><a class="meal-type-filter-item" href="#" data-mealtype="${mealType}">${mealType}</a></li>`;
            mealTypeFilterOptions.append(mealTypeLink);
            $('#mealTypeFilterOptionsMobile').append(mealTypeLink);
        });

    } catch (error) {
        console.error("Error populating filters:", error);
        showToast("Could not load filter options.", "warning");
    }
}

function resetActiveFiltersAndSearch(filterType = null) {
    if (filterType !== "search") {
        searchInput.val("");
        $('#searchInputMobile').val("");
    }
    if (filterType !== "tag") {
        $('#tagFilterOptionsContainer').parent().find('> a').html('Filter by Tag <span uk-icon="icon: chevron-down"></span>');
        // Remove uk-active from all tag filter items in both desktop and mobile
        $('.tag-filter-item.uk-active').removeClass('uk-active');
    }
    if (filterType !== "mealType") {
        $('#mealTypeFilterOptionsContainer').parent().find('> a').html('Filter by Meal Type <span uk-icon="icon: chevron-down"></span>');
        // Remove uk-active from all meal type filter items in both desktop and mobile
        $('.meal-type-filter-item.uk-active').removeClass('uk-active');
    }
}

function handleTagFilterClick(event) {
    event.preventDefault();
    const selectedTag = $(this).data("tag");
    const selectedTagText = $(this).text();
    currentPage = 1;
    resetActiveFiltersAndSearch("tag"); // Resets labels and clears active states
    const newLabel = selectedTag ? `Tag: ${selectedTagText}` : 'Filter by Tag';

    // Update label for desktop dropdown trigger
    $('#tagFilterOptionsContainer').parent().find('> a').html(`${newLabel} <span uk-icon="icon: chevron-down"></span>`);
    // Update label for mobile off-canvas accordion trigger (if structured similarly or needs separate update)
    // This might need adjustment based on actual mobile nav structure if it's different
    // For now, assume the mobile filter display is just the list, not a separate button text.

    // Set active state for the clicked item and its counterpart in the other menu
    $('.tag-filter-item.uk-active').removeClass('uk-active'); // Clear previous active
    $(`.tag-filter-item[data-tag="${selectedTag}"]`).addClass('uk-active'); // Set current active for both lists

    if (selectedTag) { currentApiCallState = { type: "tag", query: selectedTag, params: { limit: RECIPES_PER_PAGE, skip: 0 } }; fetchFromAPI(`tag/${selectedTag}`, { limit: RECIPES_PER_PAGE, skip: 0 }, "GET", null, false, false, true); }
    else { fetchAllRecipes(0, RECIPES_PER_PAGE); }
    UIkit.dropdown($('#tagFilterOptionsContainer')).hide(false); // Close desktop dropdown
    UIkit.offcanvas('#offcanvas-nav').hide(); // Close mobile offcanvas
}

function handleMealTypeFilterClick(event) {
    event.preventDefault();
    const selectedMealType = $(this).data("mealtype");
    const selectedMealTypeText = $(this).text();
    currentPage = 1;
    resetActiveFiltersAndSearch("mealType");
    const newLabel = selectedMealType ? `Type: ${selectedMealTypeText}` : 'Filter by Meal Type';

    $('#mealTypeFilterOptionsContainer').parent().find('> a').html(`${newLabel} <span uk-icon="icon: chevron-down"></span>`);

    $('.meal-type-filter-item.uk-active').removeClass('uk-active');
    $(`.meal-type-filter-item[data-mealtype="${selectedMealType}"]`).addClass('uk-active');

    if (selectedMealType) { currentApiCallState = { type: "mealType", query: selectedMealType, params: { limit: RECIPES_PER_PAGE, skip: 0 } }; fetchFromAPI(`meal-type/${selectedMealType}`, { limit: RECIPES_PER_PAGE, skip: 0 }, "GET", null, false, false, true); }
    else { fetchAllRecipes(0, RECIPES_PER_PAGE); }
    UIkit.dropdown($('#mealTypeFilterOptionsContainer')).hide(false);
    UIkit.offcanvas('#offcanvas-nav').hide();
}

// --- Recipe Detail Functions ---
async function displayRecipeDetails(recipeId){
    const recipe = await fetchFromAPI(recipeId, {}, "GET", null, false, true, false);
    if(!recipe) {
        recipeDetailModalBody.html('<p class="uk-text-center uk-text-danger">Could not load recipe details.</p>');
        UIkit.modal(recipeDetailModalElement).show();
        return;
    }
    recipeDetailModalLabel.text(recipe.name);
    let ingredientsHtml='<ul class="uk-list uk-list-bullet">';
    (recipe.ingredients||[]).forEach(ingredient => { ingredientsHtml+=`<li><span uk-icon="icon: check; ratio: 0.8" class="uk-text-success uk-margin-small-right"></span>${ingredient}</li>`});
    ingredientsHtml+="</ul>";
    let instructionsHtml="<ol class='uk-list uk-list-decimal'>";
    (recipe.instructions||[]).forEach(step => {instructionsHtml+=`<li class="uk-margin-small-bottom">${step}</li>`});
    instructionsHtml+="</ol>";
    let tagsHtml=(recipe.tags||[]).map(tag=>`<span class="uk-label uk-margin-small-right uk-margin-small-bottom">${tag}</span>`).join("");
    let mealTypesHtml=(recipe.mealType||[]).map(type=>`<span class="uk-label uk-label-warning uk-margin-small-right uk-margin-small-bottom">${type}</span>`).join("");

    recipeDetailModalBody.html(`
        <div class="uk-grid-divider uk-child-width-expand@s" uk-grid>
            <div class="uk-width-1-3@m uk-text-center uk-margin-bottom uk-margin-md-bottom@m">
                <img src="${recipe.image}" alt="${recipe.name}" class="uk-img uk-border-rounded uk-box-shadow-small" style="max-height: 300px; object-fit: cover;">
            </div>
            <div>
                <h4>${recipe.name}</h4>
                <p class="uk-margin-small"><strong><span uk-icon="icon: location; ratio: 0.9" class="uk-text-primary"></span> Cuisine:</strong> ${recipe.cuisine}</p>
                <p class="uk-margin-small"><strong><span uk-icon="icon: bolt; ratio: 0.9" class="uk-text-warning"></span> Difficulty:</strong> ${recipe.difficulty}</p>
                <p class="uk-margin-small"><strong><span uk-icon="icon: star; ratio: 0.9" class="uk-text-warning"></span> Rating:</strong> ${recipe.rating?recipe.rating.toFixed(1):"N/A"} (${recipe.reviewCount||0} reviews)</p>
                <p class="uk-margin-small"><strong><span uk-icon="icon: flame; ratio: 0.9" class="uk-text-danger"></span> Calories:</strong> ${recipe.caloriesPerServing} per serving</p>
                <p class="uk-margin-small"><strong><span uk-icon="icon: clock; ratio: 0.9" class="uk-text-primary"></span> Prep Time:</strong> ${recipe.prepTimeMinutes} min</p>
                <p class="uk-margin-small"><strong><span uk-icon="icon: history; ratio: 0.9" class="uk-text-primary"></span> Cook Time:</strong> ${recipe.cookTimeMinutes} min</p>
                <p class="uk-margin-small"><strong><span uk-icon="icon: users; ratio: 0.9" class="uk-text-muted"></span> Servings:</strong> ${recipe.servings}</p>
            </div>
        </div>
        <hr class="uk-divider-icon">
        <h5><span uk-icon="icon: list; ratio: 1.1" class="uk-text-primary"></span> Ingredients</h5>${ingredientsHtml}
        <hr class="uk-divider-icon">
        <h5><span uk-icon="icon: happy; ratio: 1.1" class="uk-text-primary"></span> Instructions</h5>${instructionsHtml}
        <hr class="uk-divider-icon">
        ${tagsHtml?`<h6><span uk-icon="icon: tag; ratio: 1.1" class="uk-text-muted"></span> Tags</h6><p>${tagsHtml}</p>`:""}
        ${mealTypesHtml?`<h6><span uk-icon="icon: world; ratio: 1.1" class="uk-text-warning"></span> Meal Types</h6><p>${mealTypesHtml}</p>`:""}
    `);
    recipeDetailModalElement.dataset.recipeId=recipe.id;
    editRecipeModalBtn.data("id",recipe.id);
    deleteRecipeModalBtn.data("id",recipe.id);
    UIkit.modal(recipeDetailModalElement).show();
}
function handleViewRecipeClick(){
    if ($(this).data("id")) {
        displayRecipeDetails($(this).data("id"));
    }
}

// --- Pagination Functions ---
function updatePagination() {
    paginationControls.empty();
    const totalPages = Math.ceil(totalRecipes / RECIPES_PER_PAGE);

    if (totalPages <= 1) {
        paginationControls.addClass("uk-hidden");
        return;
    }
    paginationControls.removeClass("uk-hidden");

    paginationControls.append(`<li class="${1 === currentPage ? "uk-disabled" : ""}"><a href="#" data-page="${currentPage - 1}" aria-label="Previous"><span uk-pagination-previous></span></a></li>`);

    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
        if (currentPage < totalPages / 2) {
            endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        } else {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }
    }
     if (endPage - startPage + 1 > maxPagesToShow) { //This case can happen if maxPagesToShow is small and we are near the beginning
        if (currentPage > totalPages / 2) {
             startPage = endPage - maxPagesToShow + 1;
        } else {
            endPage = startPage + maxPagesToShow -1;
        }
    }
    startPage = Math.max(1,startPage); // Ensure startPage is not less than 1
    endPage = Math.min(totalPages, endPage); // Ensure endPage is not greater than totalPages


    if (startPage > 1) {
        paginationControls.append('<li><a href="#" data-page="1">1</a></li>');
        if (startPage > 2) {
            paginationControls.append('<li class="uk-disabled"><span>...</span></li>');
        }
    }

    if (endPage >= startPage) { // Check if there is a range to display
        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
            paginationControls.append(`<li class="${pageNum === currentPage ? "uk-active" : ""}" ${pageNum === currentPage ? 'aria-current="page"' : ""}><a href="#" data-page="${pageNum}">${pageNum}</a></li>`);
        }
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationControls.append('<li class="uk-disabled"><span>...</span></li>');
        }
        paginationControls.append(`<li><a href="#" data-page="${totalPages}">${totalPages}</a></li>`);
    }

    paginationControls.append(`<li class="${currentPage === totalPages ? "uk-disabled" : ""}"><a href="#" data-page="${currentPage + 1}" aria-label="Next"><span uk-pagination-next></span></a></li>`);
}

function handlePageClick(event) {
    event.preventDefault();
    const clickedElement = $(this);
    if (clickedElement.closest("li").hasClass("uk-disabled") || clickedElement.closest("li").hasClass("uk-active")) {
        return;
    }
    const page = parseInt(clickedElement.data("page"));
    const totalPages = Math.ceil(totalRecipes/RECIPES_PER_PAGE);

    if (isNaN(page) || page < 1 || (page > totalPages && totalPages > 0) ) { // Allow page > totalPages if totalPages is 0 (no results)
        return;
    }

    if (page !== currentPage) {
        currentPage = page;
        const skip = (currentPage - 1) * RECIPES_PER_PAGE;
        const { type, query } = currentApiCallState;
        if (type === "search" && query) {
            fetchFromAPI(API_BASE_URL + "/search", { q: query, limit: RECIPES_PER_PAGE, skip: skip }, "GET", null, true, false, false);
        } else if (type === "tag" && query) {
            fetchFromAPI(`tag/${query}`, { limit: RECIPES_PER_PAGE, skip: skip }, "GET", null, false, false, true);
        } else if (type === "mealType" && query) {
            fetchFromAPI(`meal-type/${query}`, { limit: RECIPES_PER_PAGE, skip: skip }, "GET", null, false, false, true);
        } else {
            fetchAllRecipes(skip, RECIPES_PER_PAGE);
        }
    }
}

// State to keep track of the current type of API call for pagination
let currentApiCallState = { type: 'all', query: null, params: {} };

// --- Sorting Functions ---
function handleSortChange() { currentPage = 1; resetActiveFiltersAndSearch(); fetchAllRecipes(0, RECIPES_PER_PAGE); }

// --- Add/Edit/Delete Recipe Functions ---
function prepareAddRecipeModal() {
    addEditRecipeModalLabel.text('Add New Recipe');
    addEditRecipeForm[0].reset();
    $('#recipeId').val('');
    addEditRecipeForm.find('.uk-form-danger').removeClass('uk-form-danger'); // Clear UIkit validation states
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
        addEditRecipeForm.find('.uk-form-danger').removeClass('uk-form-danger');
        UIkit.modal(recipeDetailModalElement).hide();
        UIkit.modal(addEditRecipeModalElement).show();
    } else { showToast("Could not load recipe data for editing.", "warning"); }
}

async function handleAddEditRecipeSubmit(event) {
    event.preventDefault();
    const recipeId = $('#recipeId').val();
    const isEditMode = !!recipeId;

    // Basic UIkit validation - add uk-form-danger to invalid fields
    addEditRecipeForm.find('input[required], textarea[required]').each(function() {
        if (!$(this).val()) $(this).addClass('uk-form-danger');
        else $(this).removeClass('uk-form-danger');
    });

    if (!addEditRecipeForm[0].checkValidity()) {
        event.stopPropagation();
        showToast("Please fill all required fields correctly.", "warning"); return;
    }
     addEditRecipeForm.find('.uk-form-danger').removeClass('uk-form-danger');

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
        UIkit.modal(addEditRecipeModalElement).hide();
        addEditRecipeForm[0].reset();
        // Instead of .recipe-card-col, we look for the div with data-recipe-id directly
        if (isEditMode) { $(`div[data-recipe-id="${result.id}"]`).replaceWith(createRecipeCard(result)); }
        else { recipeCardGrid.prepend(createRecipeCard(result)); totalRecipes++; updatePagination(); } // Prepend to main grid
    } else { showToast(`Failed to ${isEditMode ? 'update' : 'add'} recipe. ${result ? result.message : 'Unknown error.'}`, 'warning'); }
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
        UIkit.modal(recipeDetailModalElement).hide(); // Hide if open
        // Remove card from grid
        $(`div[data-recipe-id="${recipeId}"]`).parent().remove(); // Remove the parent div if card is wrapped, or just the div itself
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
        showToast(`Failed to delete recipe. ${result ? result.message : 'Simulation error or API did not confirm deletion.'}`, 'warning');
    }
}


// --- Initialization ---
$(document).ready(function() {
    console.log("Script loaded and DOM ready!");

    populateFilterDropdowns();
    fetchAllRecipes();

    function handleSearchSubmit(event) {
        event.preventDefault(); currentPage = 1;
        const searchTerm = $(this).find('input[type="search"]').val().trim(); // Get search term from the form that was submitted
        resetActiveFiltersAndSearch('search');
        if (searchTerm) {
            currentApiCallState = { type: 'search', query: searchTerm, params: {} };
            fetchFromAPI(API_BASE_URL + '/search', { q: searchTerm, limit: RECIPES_PER_PAGE, skip: 0 }, 'GET', null, true, false, false);
        } else { fetchAllRecipes(0, RECIPES_PER_PAGE); }
        UIkit.offcanvas('#offcanvas-nav').hide(); // Close mobile offcanvas if search came from there
    }

    // Event Listeners
    searchForm.on('submit', handleSearchSubmit);
    $('#searchFormMobile').on('submit', handleSearchSubmit); // For mobile search

    // Delegate events for desktop dropdowns
    $(document).on('click', '#tagFilterOptions .tag-filter-item', handleTagFilterClick);
    $(document).on('click', '#mealTypeFilterOptions .meal-type-filter-item', handleMealTypeFilterClick);

    // Delegate events for mobile off-canvas menu items
    $(document).on('click', '#tagFilterOptionsMobile .tag-filter-item', handleTagFilterClick);
    $(document).on('click', '#mealTypeFilterOptionsMobile .meal-type-filter-item', handleMealTypeFilterClick);

    sortBySelect.on('change', handleSortChange);
    sortOrderSelect.on('change', handleSortChange);
    paginationControls.on('click', 'a', handlePageClick); // UIkit pagination uses simple <a>
    recipeCardGrid.on('click', '.view-recipe-btn', handleViewRecipeClick);

    addRecipeBtn.on('click', prepareAddRecipeModal);
    $('#addRecipeBtnMobile').on('click', function() { // For mobile add button
        prepareAddRecipeModal();
        UIkit.modal(addEditRecipeModalElement).show();
        UIkit.offcanvas('#offcanvas-nav').hide();
    });

    addEditRecipeForm.on('submit', handleAddEditRecipeSubmit);
    editRecipeModalBtn.on('click', handleEditRecipeClick);
    deleteRecipeModalBtn.on('click', handleDeleteRecipeClick);
});