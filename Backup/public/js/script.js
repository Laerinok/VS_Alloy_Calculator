// public/js/calc_script.js

(function () {
    // --- Constants ---
    const NUGGETS_PER_INGOT = 20; // 1 ingot = 20 nuggets
    const METAL_UNITS_PER_NUGGET = 5; // 1 nugget = 5 metal units

    // --- Global Variables (within the module scope) ---
    let metalsData = [];
    let translations = {};
    let currentLanguage = 'en'; // Default language, will be determined dynamically

    // --- DOMContentLoaded Event Listener ---
    document.addEventListener('DOMContentLoaded', async () => {
        currentLanguage = getLanguage(); // Determine language early
        await initializeCalculator();
    });

    /**
     * Determines the language based on URL parameter or browser settings.
     * @returns {string} The determined language code (e.g., 'en', 'fr').
     */
    function getLanguage() {
        const params = new URLSearchParams(window.location.search);
        if (params.has('lang')) {
            return params.get('lang');
        }
        // Fallback to browser language if available and supported, otherwise default to 'fr'
        const browserLang = navigator.language.split('-')[0];
        if (['en', 'fr'].includes(browserLang)) { // Add more supported languages here
            return browserLang;
        }
        return 'fr'; // Default
    }

    /**
     * Initializes the calculator by loading data and setting up event listeners.
     */
    async function initializeCalculator() {
        await loadData();
        updateTextContent(); // Update static text content after loading translations
        populateMetalSelect();
        setupEventListeners();
        displayAlloyInputs(); // Initial display and calculation
    }

    /**
     * Loads metals data and translations from JSON files.
     */
    async function loadData() {
        try {
            const [metalsResponse, langResponse] = await Promise.all([
                fetch('data/metals.json'),
                fetch(`lang/${currentLanguage}.json`)
            ]);

            if (!metalsResponse.ok) throw new Error(`HTTP error! status: ${metalsResponse.status} for metals.json`);
            if (!langResponse.ok) throw new Error(`HTTP error! status: ${langResponse.status} for ${currentLanguage}.json`);

            metalsData = await metalsResponse.json();
            translations = await langResponse.json();
            console.log('Data loaded:', { metalsData, translations });

        } catch (error) {
            console.error('Error loading data:', error);
            document.getElementById('validation-message').textContent = translations.error_data_loading || 'Error loading data. Please try again.';
            document.getElementById('validation-message').style.display = 'block';
        }
    }

    /**
     * Updates text content of elements based on `data-lang-key` attributes.
     */
    function updateTextContent() {
        // Update specific elements directly based on their IDs for the initial HTML
        document.getElementById('app-title-tag').textContent = translations.app_title_tag || 'Alloy Calculator';
        document.getElementById('main-app-title').textContent = translations.main_app_title || 'Alloy Calculator - Isolated Test';
        document.getElementById('label-metal-select').textContent = translations.label_metal_select || 'Select an Alloy:';
        document.getElementById('label-desired-quantity').textContent = translations.label_desired_quantity || 'Desired Quantity (in Metal Units):';
        document.getElementById('output-unit-text').textContent = translations.output_unit_text || 'Alloy Composition (in nuggets)';
    }

    /**
     * Populates the metal selection dropdown with alloy options.
     */
    function populateMetalSelect() {
        const metalSelect = document.getElementById('metal-select');
        metalSelect.innerHTML = '';
        const alloys = metalsData.filter(metal => metal.type === 'alloy' && metal.components && metal.components.length > 0);

        if (alloys.length === 0) {
            metalSelect.innerHTML = `<option>${translations.no_alloys_found || 'No alloys with components found.'}</option>`;
            return;
        }
        alloys.forEach(alloy => {
            const option = document.createElement('option');
            option.value = alloy.id;
            option.textContent = translations.metals[alloy.id] ? translations.metals[alloy.id].name : alloy.id;
            metalSelect.appendChild(option);
        });
    }

    /**
     * Sets up all global event listeners for the calculator.
     */
    function setupEventListeners() {
        document.getElementById('metal-select').addEventListener('change', displayAlloyInputs);
        document.getElementById('desired-quantity').addEventListener('input', handleDesiredQuantityInput);

        document.getElementById('desired-quantity').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                calculateAlloy();
                const metalSelect = document.getElementById('metal-select');
                const selectedMetalId = metalSelect.value;
                const selectedAlloy = metalsData.find(metal => metal.id === selectedMetalId);
                if (selectedAlloy && selectedAlloy.components && selectedAlloy.components.length > 0) {
                    const firstInputComp = selectedAlloy.components[0];
                    const sliderElement = document.getElementById(`comp-${firstInputComp.metalId}`);
                    if (sliderElement) {
                        sliderElement.focus();
                    }
                }
            }
        });

        // Language flag event listeners
        document.getElementById('flag-en').addEventListener('click', () => setLanguage('en'));
        document.getElementById('flag-fr').addEventListener('click', () => setLanguage('fr'));
    }

    /**
     * Sets the application language and reloads the page.
     * @param {string} lang - The language code (e.g., 'en', 'fr').
     */
    function setLanguage(lang) {
        const url = new URL(window.location.href);
        url.searchParams.set('lang', lang);
        window.location.href = url.toString();
    }

    /**
     * Handles input for the desired quantity, ensuring it's a positive number.
     */
    function handleDesiredQuantityInput() {
        const quantityInput = document.getElementById('desired-quantity');
        let value = parseFloat(quantityInput.value);

        if (isNaN(value) || value < 0) {
            quantityInput.value = '';
            displayValidationMessage(translations.error_positive_quantity || 'Please enter a positive quantity.');
        } else {
            hideValidationMessage();
            calculateAlloy();
        }
    }

    /**
     * Creates and returns a slider HTML element for a given component.
     * @param {object} comp - The component object from metalsData.
     * @returns {HTMLElement} The div element containing the slider and its controls.
     */
    function createSliderForComponent(comp) {
        const baseMetalName = translations.metals[comp.metalId] ? translations.metals[comp.metalId].name : comp.metalId;
        const div = document.createElement('div');
        div.classList.add('alloy-input-group');
        div.innerHTML = `
            <label for="comp-${comp.metalId}">${baseMetalName} (${translations.nuggets_short || 'Nuggets'}): <span id="slider-value-${comp.metalId}" aria-live="polite"></span></label>
            <div class="slider-controls">
                <button type="button" class="slider-btn" data-action="decrement" data-step="10" data-target="comp-${comp.metalId}">-10</button>
                <button type="button" class="slider-btn" data-action="decrement" data-step="1" data-target="comp-${comp.metalId}">-1</button>
                <input type="range" id="comp-${comp.metalId}" data-metal-id="${comp.metalId}" step="1"
                       aria-label="${baseMetalName} ${translations.nuggets_short || 'Nuggets'} quantity slider">
                <button type="button" class="slider-btn" data-action="increment" data-step="1" data-target="comp-${comp.metalId}">+1</button>
                <button type="button" class="slider-btn" data-action="increment" data-step="10" data-target="comp-${comp.metalId}">+10</button>
            </div>
            <p class="slider-info">${translations.slider_keyboard_info || 'Use &larr;/&rarr; for &plusmn;1, and &uarr;/&darr; for &plusmn;10.'}</p>
            <div id="info-message-${comp.metalId}" class="component-info"></div>
        `;
        return div;
    }

    /**
     * Displays the appropriate input fields (sliders) for the selected alloy.
     */
    function displayAlloyInputs() {
        const metalSelect = document.getElementById('metal-select');
        const selectedMetalId = metalSelect.value;
        const alloyInputsContainer = document.getElementById('alloy-inputs');
        alloyInputsContainer.innerHTML = '';

        const selectedAlloy = metalsData.find(metal => metal.id === selectedMetalId);

        if (selectedAlloy && selectedAlloy.components) {
            selectedAlloy.components.forEach(comp => {
                const sliderGroup = createSliderForComponent(comp);
                alloyInputsContainer.appendChild(sliderGroup);

                const sliderElement = document.getElementById(`comp-${comp.metalId}`);
                sliderElement.addEventListener('input', (e) => calculateAlloy(e));
                sliderElement.addEventListener('change', (e) => calculateAlloy(e));

                sliderElement.addEventListener('keydown', (e) => {
                    let currentValue = parseInt(sliderElement.value, 10);
                    let stepAmount = 0;

                    switch (e.key) {
                        case 'ArrowLeft':
                            stepAmount = -1;
                            break;
                        case 'ArrowRight':
                            stepAmount = 1;
                            break;
                        case 'ArrowDown':
                            stepAmount = -10;
                            break;
                        case 'ArrowUp':
                            stepAmount = 10;
                            break;
                        default:
                            return;
                    }

                    e.preventDefault();

                    let newValue = currentValue + stepAmount;
                    newValue = Math.max(parseInt(sliderElement.min, 10), Math.min(parseInt(sliderElement.max, 10), newValue));

                    sliderElement.value = newValue;
                    calculateAlloy({ target: sliderElement });
                });
            });

            alloyInputsContainer.addEventListener('click', (e) => {
                const button = e.target.closest('.slider-btn');
                if (button) {
                    const targetId = button.dataset.target;
                    const targetSlider = document.getElementById(targetId);
                    const action = button.dataset.action;
                    const step = parseInt(button.dataset.step, 10);
                    let currentValue = parseInt(targetSlider.value, 10);

                    if (action === 'increment') {
                        currentValue += step;
                    } else if (action === 'decrement') {
                        currentValue -= step;
                    }

                    currentValue = Math.max(parseInt(targetSlider.min, 10), Math.min(parseInt(targetSlider.max, 10), currentValue));
                    targetSlider.value = currentValue;
                    calculateAlloy({ target: targetSlider });
                }
            });
        }
        calculateAlloy();
    }

    /**
     * Main function to calculate alloy components based on desired quantity and user inputs.
     * @param {Event} [event] - The event that triggered the calculation (optional, for slider changes).
     */
    function calculateAlloy(event) {
        const metalSelect = document.getElementById('metal-select');
        const selectedMetalId = metalSelect.value;
        const selectedAlloy = metalsData.find(metal => metal.id === selectedMetalId);

        const desiredQuantityInput = document.getElementById('desired-quantity');
        const desiredQuantityMetalUnits = parseFloat(desiredQuantityInput.value);
        const totalDesiredNuggets = desiredQuantityMetalUnits / METAL_UNITS_PER_NUGGET;

        hideValidationMessage();
        document.getElementById('results').innerHTML = '';

        if (!selectedAlloy || !selectedAlloy.components || selectedAlloy.components.length === 0 || isNaN(totalDesiredNuggets) || totalDesiredNuggets <= 0) {
            document.getElementById('results').innerHTML = `<p>${translations.select_valid_alloy_and_quantity || 'Please select a valid alloy and enter a positive quantity.'}</p>`;
            return;
        }

        updateComponentInputsAndMessages(selectedAlloy, totalDesiredNuggets);

        let alloyInputsPercentages = {};
        let hasError = false;

        const activeElement = event ? event.target : null;
        const activeMetalId = activeElement ? activeElement.dataset.metalId : null;

        if (selectedAlloy.components.length === 2) {
            const comp1 = selectedAlloy.components[0];
            const comp2 = selectedAlloy.components[1];
            const inputElement1 = document.getElementById(`comp-${comp1.metalId}`);
            const inputElement2 = document.getElementById(`comp-${comp2.metalId}`);
            const sliderValueSpan1 = document.getElementById(`slider-value-${comp1.metalId}`);
            const sliderValueSpan2 = document.getElementById(`slider-value-${comp2.metalId}`);

            let nuggetsValue1, nuggetsValue2;

            if (activeMetalId === comp2.metalId) {
                nuggetsValue2 = parseInt(inputElement2.value, 10);
                nuggetsValue1 = totalDesiredNuggets - nuggetsValue2;
                inputElement1.value = nuggetsValue1;
                if (sliderValueSpan1) sliderValueSpan1.textContent = nuggetsValue1;
            } else {
                nuggetsValue1 = parseInt(inputElement1.value, 10);
                nuggetsValue2 = totalDesiredNuggets - nuggetsValue1;
                inputElement2.value = nuggetsValue2;
                if (sliderValueSpan2) sliderValueSpan2.textContent = nuggetsValue2;
            }

            inputElement1.classList.remove('input-error');
            inputElement2.classList.remove('input-error');

            [comp1, comp2].forEach((comp, index) => {
                const nuggetsValue = (index === 0) ? nuggetsValue1 : nuggetsValue2;
                const inputElement = (index === 0) ? inputElement1 : inputElement2;

                if (isNaN(nuggetsValue) || nuggetsValue < 0) {
                    displayValidationMessage(translations.error_invalid_nuggets.replace('{metalName}', translations.metals[comp.metalId]?.name || comp.metalId));
                    inputElement.classList.add('input-error');
                    hasError = true;
                    return;
                }

                const percent = (nuggetsValue / totalDesiredNuggets) * 100;

                if (percent < comp.minPercent || percent > comp.maxPercent) {
                    displayValidationMessage(
                        translations.percentage_out_of_range
                            .replace('{metalName}', translations.metals[comp.metalId]?.name || comp.metalId)
                            .replace('{value}', percent.toFixed(1))
                            .replace('{min}', comp.minPercent)
                            .replace('{max}', comp.maxPercent)
                    );
                    inputElement.classList.add('input-error');
                    hasError = true;
                } else {
                    alloyInputsPercentages[comp.metalId] = percent;
                }
            });

        } else if (selectedAlloy.components.length >= 3) {
            let currentNuggetInputs = {};
            let components = selectedAlloy.components;

            components.forEach(comp => {
                const inputElement = document.getElementById(`comp-${comp.metalId}`);
                inputElement.classList.remove('input-error');
                currentNuggetInputs[comp.metalId] = parseInt(inputElement.value, 10);
            });

            const isGlobalUpdate = !event || !activeMetalId;

            if (isGlobalUpdate) {
                let sumOfDefaultPercents = components.reduce((sum, c) => sum + (c.minPercent + c.maxPercent) / 2, 0);
                let distributedNuggetsSum = 0;

                components.forEach((comp, index) => {
                    const defaultPercentage = (comp.minPercent + comp.maxPercent) / 2;
                    let nuggets = Math.round((defaultPercentage / sumOfDefaultPercents) * totalDesiredNuggets);

                    if (index === components.length - 1) {
                        nuggets = totalDesiredNuggets - distributedNuggetsSum;
                    }

                    const inputElement = document.getElementById(`comp-${comp.metalId}`);
                    if (inputElement) {
                        inputElement.value = nuggets;
                        currentNuggetInputs[comp.metalId] = nuggets;
                        distributedNuggetsSum += nuggets;
                    }
                });
            } else {
                const activeNuggets = currentNuggetInputs[activeMetalId];
                const remainingNuggetsForOthers = totalDesiredNuggets - activeNuggets;

                const otherComps = components.filter(c => c.metalId !== activeMetalId);
                const sumOfOtherDefaultPercents = otherComps.reduce((sum, c) => sum + (c.minPercent + c.maxPercent) / 2, 0);

                let distributedNuggetsSum = 0;
                otherComps.forEach((comp, index) => {
                    const defaultPercentage = (comp.minPercent + comp.maxPercent) / 2;
                    let newNuggets = 0;

                    if (sumOfOtherDefaultPercents > 0) {
                        newNuggets = Math.round((defaultPercentage / sumOfOtherDefaultPercents) * remainingNuggetsForOthers);
                    }

                    if (index === otherComps.length - 1) {
                        newNuggets = remainingNuggetsForOthers - distributedNuggetsSum;
                    }

                    const inputElement = document.getElementById(`comp-${comp.metalId}`);
                    if (inputElement) {
                        inputElement.value = newNuggets;
                        currentNuggetInputs[comp.metalId] = newNuggets;
                        distributedNuggetsSum += newNuggets;
                    }
                });
            }

            components.forEach(comp => {
                const nuggetsValue = currentNuggetInputs[comp.metalId];
                const inputElement = document.getElementById(`comp-${comp.metalId}`);

                const sliderValueSpan = document.getElementById(`slider-value-${comp.metalId}`);
                if (sliderValueSpan) {
                    sliderValueSpan.textContent = nuggetsValue;
                }

                if (isNaN(nuggetsValue) || nuggetsValue < 0) {
                    displayValidationMessage(translations.error_invalid_nuggets.replace('{metalName}', translations.metals[comp.metalId]?.name || comp.metalId));
                    inputElement.classList.add('input-error');
                    hasError = true;
                    return;
                }

                const percent = (nuggetsValue / totalDesiredNuggets) * 100;

                if (percent < comp.minPercent || percent > comp.maxPercent) {
                    displayValidationMessage(
                        translations.percentage_out_of_range
                            .replace('{metalName}', translations.metals[comp.metalId]?.name || comp.metalId)
                            .replace('{value}', percent.toFixed(1))
                            .replace('{min}', comp.minPercent)
                            .replace('{max}', comp.maxPercent)
                    );
                    inputElement.classList.add('input-error');
                    hasError = true;
                } else {
                    alloyInputsPercentages[comp.metalId] = percent;
                }
            });
        }

        if (hasError) {
            return;
        }

        let resultsHtml = `<h4>${translations.required_materials_for_nuggets
            .replace('{totalNuggets}', totalDesiredNuggets)
            .replace('{totalMetalUnits}', desiredQuantityMetalUnits)}</h4><ul>`;
        selectedAlloy.components.forEach(comp => {
            const percentage = alloyInputsPercentages[comp.metalId];
            const baseMetalName = translations.metals[comp.metalId] ? translations.metals[comp.metalId].name : comp.metalId;

            if (typeof percentage === 'number' && !isNaN(percentage)) {
                let quantityNeededMetalUnits = (totalDesiredNuggets * METAL_UNITS_PER_NUGGET * (percentage / 100));
                let quantityNeededNuggets = Math.round(quantityNeededMetalUnits / METAL_UNITS_PER_NUGGET);

                resultsHtml += `<li>${baseMetalName}: ${quantityNeededNuggets} ${translations.nuggets_short || 'Nuggets'}</li>`;
            } else {
                resultsHtml += `<li>${baseMetalName}: ${translations.value_not_available || 'Value not available (calculation error)'}</li>`;
            }
        });
        resultsHtml += '</ul>';

        const totalIngotsApprox = Math.round(totalDesiredNuggets / NUGGETS_PER_INGOT);
        resultsHtml += `<p>${translations.equivalent_ingots || 'This is approximately'} ${totalIngotsApprox} ${translations.ingots_short || 'Ingots'}.</p>`;

        document.getElementById('results').innerHTML = resultsHtml;
    }

    /**
     * Updates the min/max values of component sliders and their info messages.
     * @param {object} selectedAlloy - The currently selected alloy.
     * @param {number} totalDesiredNuggets - The total desired nuggets for the alloy.
     */
    function updateComponentInputsAndMessages(selectedAlloy, totalDesiredNuggets) {
        if (isNaN(totalDesiredNuggets) || totalDesiredNuggets <= 0) {
            selectedAlloy.components.forEach(comp => {
                const infoDiv = document.getElementById('info-message-' + comp.metalId);
                if (infoDiv) infoDiv.textContent = '';
            });
            return;
        }

        selectedAlloy.components.forEach(comp => {
            const inputElement = document.getElementById(`comp-${comp.metalId}`);
            const infoDiv = document.getElementById('info-message-' + comp.metalId);
            const sliderValueSpan = document.getElementById(`slider-value-${comp.metalId}`);

            const minNuggets = Math.ceil((comp.minPercent / 100) * totalDesiredNuggets);
            const maxNuggets = Math.floor((comp.maxPercent / 100) * totalDesiredNuggets);

            if (inputElement) {
                inputElement.min = minNuggets;
                inputElement.max = maxNuggets;

                let currentValue = parseInt(inputElement.value, 10);
                if (isNaN(currentValue) || currentValue < minNuggets || currentValue > maxNuggets) {
                    const defaultNuggetsForComp = Math.round(((comp.minPercent + comp.maxPercent) / 2 / 100) * totalDesiredNuggets);
                    inputElement.value = Math.max(minNuggets, Math.min(maxNuggets, defaultNuggetsForComp));
                }

                if (sliderValueSpan) {
                    sliderValueSpan.textContent = inputElement.value;
                }
            }
            if (infoDiv) {
                infoDiv.textContent = translations.valid_range_nuggets
                    .replace('{min}', minNuggets)
                    .replace('{max}', maxNuggets);
            }
        });
    }

    /**
     * Displays a validation message to the user.
     * @param {string} message - The message to display.
     */
    function displayValidationMessage(message) {
        const validationMessageElement = document.getElementById('validation-message');
        validationMessageElement.textContent = message;
        validationMessageElement.style.display = 'block';
    }

    /**
     * Hides the validation message.
     */
    function hideValidationMessage() {
        const validationMessageElement = document.getElementById('validation-message');
        validationMessageElement.textContent = '';
        validationMessageElement.style.display = 'none';
    }

})(); // End of IIFE