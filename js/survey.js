// ===============================
// Laptop Market Research Survey
// With Google Sheets Integration
// ===============================

// Google Apps Script Web App URL
// Replace this with your deployed Apps Script URL after setup
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbziSAbx-MSDM8RM0_9Ccw5zG-cjb5_BmC9e8Qm5oX_RaVL4bPFWzpjqHLb1EUbrzzDJxA/exec";

// =======================================
// Question Data
// =======================================

// Question 1
const firstQuestion = {
    question: "Do you have a laptop?",
    options: [
        "Yes",
        "No"
    ]
};

// Questions for Laptop Owners (If Answer = Yes)
const ownerQuestions = [
    {
        question: "What do you mainly use your laptop for?",
        options: ["Study", "Gaming", "Office Work", "Designing/Editing", "Coding"]
    },
    {
        question: "What do you find most useful in your current laptop?",
        options: ["Performance", "Battery Life", "Storage", "Display Quality", "Portability"]
    },
    {
        question: "What problem do you face most often with your current laptop?",
        options: ["Slow Performance", "Battery Issue", "Heating Problem", "Storage Shortage", "No Major Problem"]
    },
    {
        question: "How satisfied are you with your current laptop?",
        options: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"]
    },
    {
        question: "Which feature would you like to improve the most?",
        options: ["Processor", "RAM", "Graphics", "Battery", "Display"]
    },
    {
        question: "How often do you upgrade or replace your laptop?",
        options: ["Every 1\u20132 Years", "Every 3\u20134 Years", "Every 5+ Years", "Only When Necessary"]
    },
    {
        question: "Which laptop brand do you currently use?",
        options: ["HP", "Dell", "Lenovo", "ASUS", "Apple", "Acer", "Other"]
    },
    {
        question: "What is the most important factor when buying a laptop?",
        options: ["Price", "Performance", "Battery Life", "Brand", "Design"]
    },
    {
        question: "Would you recommend your current laptop to others?",
        options: ["Yes", "Maybe", "No"]
    }
];

// Questions for Non-Owners (If Answer = No)
const buyerQuestions = [
    {
        question: "Why do you want to buy a laptop?",
        options: ["Study", "Gaming", "Office Work", "Coding", "Entertainment"]
    },
    {
        question: "Which type of laptop would you prefer?",
        options: ["Student Laptop", "Gaming Laptop", "Business Laptop", "Budget Laptop", "Premium Laptop"]
    },
    {
        question: "What is your expected budget?",
        options: ["Below \u20b930,000", "\u20b930,000\u2013\u20b950,000", "\u20b950,000\u2013\u20b980,000", "Above \u20b980,000"]
    },
    {
        question: "Which feature is most important to you?",
        options: ["Performance", "Battery Life", "Storage", "Graphics", "Design"]
    },
    {
        question: "Which screen size do you prefer?",
        options: ["13\u201314 Inch", "15\u201316 Inch", "17 Inch or Larger"]
    },
    {
        question: "Which laptop brand would you prefer?",
        options: ["HP", "Dell", "Lenovo", "ASUS", "Apple", "Acer", "Other"]
    },
    {
        question: "How long do you expect your laptop to last?",
        options: ["1\u20132 Years", "3\u20135 Years", "More Than 5 Years"]
    },
    {
        question: "Where would you prefer to buy a laptop?",
        options: ["Online", "Offline Store", "Brand Store", "Second-Hand Market"]
    },
    {
        question: "What will influence your final buying decision the most?",
        options: ["Price", "Reviews", "Specifications", "Brand Reputation", "Recommendations"]
    }
];

// =======================================
// Survey Variables
// =======================================

let currentQuestion = 0;
let surveyQuestions = [];
let answers = [];
let questionBranchLoaded = false;

const questionElement = document.getElementById("question");
const optionsElement = document.getElementById("options");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const previousButton = document.getElementById("previousBtn");
const nextButton = document.getElementById("nextBtn");
const submitButton = document.getElementById("submitBtn");

// =======================================
// Start Survey
// =======================================

surveyQuestions.push(firstQuestion);
loadQuestion();

// =======================================
// Load Question
// =======================================

function loadQuestion()
{
    questionElement.textContent =
        surveyQuestions[currentQuestion].question;

    optionsElement.innerHTML = "";

    surveyQuestions[currentQuestion].options.forEach(function(option)
    {
        const label = document.createElement("label");
        label.className = "option";
        label.innerHTML = `
            <input type="radio" name="answer" value="${option}">
            ${option}
        `;

        // Restore previously selected answer
        if (answers[currentQuestion] === option)
        {
            label.querySelector("input").checked = true;
        }

        optionsElement.appendChild(label);
    });

    updateProgress();
    updateButtons();
}

// =======================================
// Get Selected Answer
// =======================================

function getSelectedAnswer()
{
    const selected = document.querySelector('input[name="answer"]:checked');
    return selected ? selected.value : null;
}

// =======================================
// Dynamic Question Branching
// =======================================

function loadQuestionBranch(answer)
{
    if (questionBranchLoaded) return;

    questionBranchLoaded = true;

    if (answer === "Yes")
    {
        ownerQuestions.forEach(function(q)
        {
            surveyQuestions.push(q);
        });
    }
    else if (answer === "No")
    {
        buyerQuestions.forEach(function(q)
        {
            surveyQuestions.push(q);
        });
    }
}

// =======================================
// Progress Bar
// =======================================

function updateProgress()
{
    // On the first question before branching, show "Question 1 of 10"
    // (1 first + 9 follow-up), since we know the total will be 10
    const totalQuestions = (currentQuestion === 0 && !questionBranchLoaded)
        ? 10
        : surveyQuestions.length;

    progressText.textContent =
        `Question ${currentQuestion + 1} of ${totalQuestions}`;

    progressBar.style.width =
        ((currentQuestion + 1) / totalQuestions) * 100 + "%";
}

// =======================================
// Buttons
// =======================================

function updateButtons()
{
    previousButton.style.display =
        currentQuestion === 0 ? "none" : "inline-block";

    // On the first question, ALWAYS show Next (not Submit)
    // because more questions will be loaded dynamically
    if (currentQuestion === 0)
    {
        nextButton.style.display = "inline-block";
        submitButton.style.display = "none";
    }
    else if (currentQuestion === surveyQuestions.length - 1)
    {
        nextButton.style.display = "none";
        submitButton.style.display = "inline-block";
    }
    else
    {
        nextButton.style.display = "inline-block";
        submitButton.style.display = "none";
    }
}

// =======================================
// Next Button Handler
// =======================================

nextButton.addEventListener("click", function()
{
    const selected = getSelectedAnswer();

    if (!selected)
    {
        alert("Please select an answer before proceeding.");
        return;
    }

    // Save answer
    answers[currentQuestion] = selected;

    // If on the first question, load branch questions
    if (currentQuestion === 0)
    {
        loadQuestionBranch(selected);
    }

    currentQuestion++;
    loadQuestion();
});

// =======================================
// Previous Button Handler
// =======================================

previousButton.addEventListener("click", function()
{
    if (currentQuestion > 0)
    {
        // Save current answer before going back
        const selected = getSelectedAnswer();
        if (selected)
        {
            answers[currentQuestion] = selected;
        }

        currentQuestion--;
        loadQuestion();
    }
});

// =======================================
// Submit Button Handler
// =======================================

submitButton.addEventListener("click", function()
{
    const selected = getSelectedAnswer();

    if (!selected)
    {
        alert("Please select an answer before submitting.");
        return;
    }

    // Save last answer
    answers[currentQuestion] = selected;

    // Build response data
    const responseData = {};
    surveyQuestions.forEach(function(q, index)
    {
        responseData["Q" + (index + 1)] = answers[index] || "Not Answered";
    });

    // Add timestamp
    responseData["timestamp"] = new Date().toISOString();

    console.log("Survey Submitted");
    console.table(responseData);

    // Store locally
    localStorage.setItem("surveyData", JSON.stringify(responseData));

    // Send to Google Sheets
    sendToGoogleSheets(responseData);

    // Show thank you message
    const surveyCard = document.querySelector(".survey-card");

    surveyCard.innerHTML = `
        <h1 style="text-align:center; margin-bottom:15px;">Thank You!</h1>
        <p style="text-align:center; color:#cbd5e1; margin-bottom:25px;">
            Your survey responses have been recorded successfully.
            We appreciate your participation in the Laptop Market Research.
        </p>
        <div style="text-align:center; display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
            <a href="dashboard.html" style="display:inline-block; padding:14px 28px; background:#16a34a; color:#fff; border-radius:10px; text-decoration:none; font-weight:600;">
                View Dashboard
            </a>
            <a href="index.html" style="display:inline-block; padding:14px 28px; background:#2563eb; color:#fff; border-radius:10px; text-decoration:none; font-weight:600;">
                Back to Home
            </a>
        </div>
    `;
});

// =======================================
// Google Sheets Integration
// =======================================

function sendToGoogleSheets(data)
{
    if (GOOGLE_SHEETS_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE")
    {
        console.log("Google Sheets URL not configured. Data saved locally only.");
        console.log("To enable Google Sheets integration, follow the setup instructions in SETUP.md");
        return;
    }

    fetch(GOOGLE_SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(function()
    {
        console.log("Survey data sent to Google Sheets successfully.");
    })
    .catch(function(error)
    {
        console.error("Error sending data to Google Sheets:", error);
        console.log("Data is saved locally and can be synced later.");
    });
}
