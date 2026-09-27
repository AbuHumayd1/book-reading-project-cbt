/* =========================================================
   BOOK READING PROJECT
   Main Frontend JavaScript
   ========================================================= */


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let currentStudent = null;

let books = [];

let selectedBook = null;

let questions = [];

let currentQuestion = 0;

let answers = {};

let reviewed = {};

let attemptId = null;

let timerInterval = null;

let remainingSeconds = 0;

let examActive = false;

let examSubmitting = false;

let examTerminated = false;

let visibilityWarningShown = false;


/* =========================================================
   API HELPER
   ========================================================= */

/**
 * Sends requests to the Netlify Function.
 *
 * Frontend:
 *     fetch("/api")
 *
 * Netlify:
 *     /.netlify/functions/api
 *
 * Netlify Function:
 *     Google Apps Script
 *
 * @param {string} action
 * @param {object} data
 * @returns {Promise<any>}
 */
async function api(action, data = {}) {

  try {

    const response = await fetch(
      "/api",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          action: action,
          data: data
        })
      }
    );


    if (!response.ok) {

      let errorMessage =
        `Request failed with status ${response.status}.`;

      try {

        const errorData =
          await response.json();

        errorMessage =
          errorData.message ||
          errorData.error ||
          errorMessage;

      } catch (parseError) {
        // Keep original error message.
      }

      throw new Error(errorMessage);
    }


    const result =
      await response.json();


    if (!result.success) {

      throw new Error(
        result.message ||
        result.error ||
        "Request failed."
      );
    }


    return result.data;

  } catch (error) {

    console.error(
      "API ERROR:",
      error
    );

    throw error;
  }
}


/* =========================================================
   DOM HELPERS
   ========================================================= */

function getElement(id) {

  return document.getElementById(id);
}


function setText(id, value) {

  const element = getElement(id);

  if (element) {
    element.textContent =
      value ?? "";
  }
}


function showLoading(message = "Please wait...") {

  const overlay =
    getElement("loadingOverlay");

  const loadingMessage =
    getElement("loadingMessage");


  if (loadingMessage) {
    loadingMessage.textContent =
      message;
  }


  if (overlay) {
    overlay.classList.remove("hidden");
  }
}


function hideLoading() {

  const overlay =
    getElement("loadingOverlay");


  if (overlay) {
    overlay.classList.add("hidden");
  }
}


/* =========================================================
   LOGIN
   ========================================================= */

async function login() {

  const studentIdElement =
    getElement("studentId");

  const pinElement =
    getElement("studentPin");

  const messageElement =
    getElement("loginMessage");


  if (!studentIdElement || !pinElement) {
    return;
  }


  const studentId =
    studentIdElement.value.trim();

  const pin =
    pinElement.value.trim();


  if (messageElement) {
    messageElement.textContent = "";
  }


  if (!studentId) {

    if (messageElement) {
      messageElement.textContent =
        "Please enter your Student ID.";
    }

    studentIdElement.focus();

    return;
  }


  if (!pin) {

    if (messageElement) {
      messageElement.textContent =
        "Please enter your Examination PIN.";
    }

    pinElement.focus();

    return;
  }


  try {

    showLoading("Verifying your details...");


    const result =
      await api(
        "loginStudent",
        {
          studentId: studentId,
          pin: pin
        }
      );


    /*
     * Expected backend response:
     *
     * {
     *   success: true,
     *   student: {...},
     *   message: "Login successful."
     * }
     *
     * The Netlify API wrapper returns this object
     * as result.
     */


    if (!result || result.success === false) {

      throw new Error(
        result?.message ||
        "Invalid Student ID or Examination PIN."
      );
    }


    currentStudent =
      result.student ||
      result;


    if (!currentStudent) {

      throw new Error(
        "Student information was not returned."
      );
    }


    /*
     * Keep the student in sessionStorage so that
     * accidental page refreshes can be detected.
     *
     * We do NOT store the student's PIN here.
     */
    try {

      sessionStorage.setItem(
        "brp_student",
        JSON.stringify(currentStudent)
      );

    } catch (storageError) {
      console.warn(
        "Unable to save student session.",
        storageError
      );
    }


    setText(
      "studentName",
      getStudentName(currentStudent)
    );


    await loadBooks();


    showScreen("dashboardScreen");


  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );


    if (messageElement) {

      messageElement.textContent =
        error.message ||
        "Unable to login. Please try again.";
    }


  } finally {

    hideLoading();
  }
}


/* =========================================================
   STUDENT NAME
   ========================================================= */

function getStudentName(student) {

  if (!student) {
    return "Student";
  }


  return (
    student.name ||
    student.studentName ||
    student.fullName ||
    student.full_name ||
    student.Name ||
    "Student"
  );
}


/* =========================================================
   LOAD BOOKS
   ========================================================= */

async function loadBooks() {

  try {

    showLoading("Loading available books...");


    const result =
      await api("getBooks");


    if (Array.isArray(result)) {

      books = result;

    } else if (
      result &&
      Array.isArray(result.books)
    ) {

      books = result.books;

    } else {

      books = [];
    }


    renderBooks();


  } catch (error) {

    console.error(
      "LOAD BOOKS ERROR:",
      error
    );


    const container =
      getElement("booksContainer");


    if (container) {

      container.innerHTML = `
        <div class="error-state">
          Unable to load the available books.
          Please refresh the page and try again.
        </div>
      `;
    }


    throw error;


  } finally {

    hideLoading();
  }
}


/* =========================================================
   RENDER BOOKS
   ========================================================= */

function renderBooks() {

  const container =
    getElement("booksContainer");


  if (!container) {
    return;
  }


  container.innerHTML = "";


  if (!books.length) {

    container.innerHTML = `
      <div class="empty-state">
        <h3>No Books Available</h3>
        <p>
          There are currently no books available
          for examination.
        </p>
      </div>
    `;

    return;
  }


  books.forEach(function(book, index) {

    const bookId =
      book.bookId ??
      book.id ??
      book.ID ??
      index;


    const title =
      book.title ??
      book.bookTitle ??
      book.name ??
      "Untitled Book";


    const author =
      book.author ??
      book.bookAuthor ??
      "Unknown Author";


    const description =
      book.description ??
      book.bookDescription ??
      "No description available.";


    const questionCount =
      book.questions ??
      book.questionCount ??
      book.totalQuestions ??
      book.numberOfQuestions ??
      "—";


    const duration =
      book.duration ??
      book.durationMinutes ??
      book.examDuration ??
      "—";


    const card =
      document.createElement("article");


    card.className =
      "book-item";


    card.innerHTML = `
      <h3>${escapeHtml(title)}</h3>

      <p class="book-author">
        ${escapeHtml(author)}
      </p>

      <p>
        ${escapeHtml(description)}
      </p>

      <div class="book-meta">

        <span class="book-meta-item">
          ${escapeHtml(String(questionCount))} Questions
        </span>

        <span class="book-meta-item">
          ${escapeHtml(String(duration))} Minutes
        </span>

      </div>

      <button
        type="button"
        class="primary-btn"
        data-book-id="${escapeHtml(String(bookId))}"
      >
        View Book
      </button>
    `;


    const button =
      card.querySelector("button");


    if (button) {

      button.addEventListener(
        "click",
        function() {

          openBook(bookId);

        }
      );
    }


    container.appendChild(card);

  });
}


/* =========================================================
   OPEN BOOK
   ========================================================= */

async function openBook(bookId) {

  try {

    showLoading("Loading book information...");


    /*
     * First look in the already-loaded books.
     */
    let book =
      books.find(function(item) {

        return String(
          item.bookId ??
          item.id ??
          item.ID
        ) === String(bookId);

      });


    /*
     * If it isn't available locally, ask the backend.
     */
    if (!book) {

      const result =
        await api(
          "getBook",
          {
            bookId: bookId
          }
        );


      book =
        result?.book ||
        result;
    }


    if (!book) {

      throw new Error(
        "Book information could not be found."
      );
    }


    selectedBook =
      book;


    renderBookDetails();


    showScreen("bookScreen");


  } catch (error) {

    console.error(
      "OPEN BOOK ERROR:",
      error
    );


    alert(
      error.message ||
      "Unable to load this book."
    );


  } finally {

    hideLoading();
  }
}


/* =========================================================
   RENDER BOOK DETAILS
   ========================================================= */

function renderBookDetails() {

  if (!selectedBook) {
    return;
  }


  const title =
    selectedBook.title ??
    selectedBook.bookTitle ??
    selectedBook.name ??
    "Untitled Book";


  const author =
    selectedBook.author ??
    selectedBook.bookAuthor ??
    "Unknown Author";


  const description =
    selectedBook.description ??
    selectedBook.bookDescription ??
    "No description available.";


  const questionsCount =
    selectedBook.questions ??
    selectedBook.questionCount ??
    selectedBook.totalQuestions ??
    selectedBook.numberOfQuestions ??
    "—";


  const duration =
    selectedBook.duration ??
    selectedBook.durationMinutes ??
    selectedBook.examDuration ??
    "—";


  setText(
    "bookTitle",
    title
  );


  setText(
    "bookAuthor",
    author
  );


  setText(
    "bookDescription",
    description
  );


  setText(
    "bookQuestions",
    questionsCount
  );


  setText(
    "bookDuration",
    `${duration} minutes`
  );
}


/* =========================================================
   START EXAM
   ========================================================= */

async function startExam() {

  if (!currentStudent) {

    alert(
      "Your student session has expired. Please login again."
    );

    showScreen("loginScreen");

    return;
  }


  if (!selectedBook) {

    alert(
      "Please select a book first."
    );

    return;
  }


  if (examActive) {
    return;
  }


  try {

    showLoading(
      "Starting your examination..."
    );


    /*
     * Ask the backend to create/validate
     * the examination attempt.
     *
     * IMPORTANT:
     *
     * The backend must enforce:
     *
     * 1. One attempt per student/book.
     * 2. No duplicate active attempt.
     * 3. Admin reopening when required.
     * 4. Server-side expiry.
     */


    const attemptResult =
      await api(
        "startAttempt",
        {
          studentId:
            currentStudent.studentId ??
            currentStudent.id ??
            currentStudent.ID,

          bookId:
            selectedBook.bookId ??
            selectedBook.id ??
            selectedBook.ID
        }
      );


    if (!attemptResult) {

      throw new Error(
        "The examination attempt could not be created."
      );
    }


    /*
     * Accept several possible backend field names.
     */
    attemptId =
      attemptResult.attemptId ??
      attemptResult.id ??
      attemptResult.attemptID;


    if (!attemptId) {

      throw new Error(
        "The examination attempt ID was not returned."
      );
    }


    /*
     * Get the questions separately.
     */
    const questionResult =
      await api(
        "getQuestions",
        {
          bookId:
            selectedBook.bookId ??
            selectedBook.id ??
            selectedBook.ID
        }
      );


    if (Array.isArray(questionResult)) {

      questions =
        questionResult;

    } else if (
      questionResult &&
      Array.isArray(questionResult.questions)
    ) {

      questions =
        questionResult.questions;

    } else {

      questions = [];
    }


    if (!questions.length) {

      throw new Error(
        "No examination questions were found."
      );
    }


    /*
     * Reset examination state.
     */
    currentQuestion = 0;

    answers = {};

    reviewed = {};

    examSubmitting = false;

    examTerminated = false;

    visibilityWarningShown = false;

    examActive = true;


    /*
     * Determine duration.
     *
     * Priority:
     *
     * 1. Server attempt duration
     * 2. Selected book duration
     * 3. Default 60 minutes
     */
    const duration =
      Number(
        attemptResult.duration ??
        attemptResult.durationMinutes ??
        selectedBook.duration ??
        selectedBook.durationMinutes ??
        selectedBook.examDuration ??
        60
      );


    remainingSeconds =
      Math.max(
        1,
        Math.floor(duration * 60)
      );


    /*
     * Enter examination mode.
     */
    document.body.classList.add(
      "exam-mode"
    );


    renderQuestionNavigator();

    renderQuestion();

    updateTimerDisplay();

    startTimer();

    setupExamSecurity();

    showScreen("examScreen");


    /*
     * Try to enter fullscreen.
     *
     * This is a deterrent, not an absolute security
     * mechanism. The browser/user can refuse it.
     */
    requestFullscreen();


  } catch (error) {

    console.error(
      "START EXAM ERROR:",
      error
    );


    alert(
      error.message ||
      "Unable to start the examination."
    );


  } finally {

    hideLoading();
  }
}


/* =========================================================
   TIMER
   ========================================================= */

function startTimer() {

  stopTimer();


  updateTimerDisplay();


  timerInterval =
    setInterval(
      function() {

        if (!examActive) {
          return;
        }


        remainingSeconds--;


        updateTimerDisplay();


        if (remainingSeconds <= 0) {

          stopTimer();

          handleTimeExpired();
        }

      },
      1000
    );
}


function stopTimer() {

  if (timerInterval) {

    clearInterval(
      timerInterval
    );

    timerInterval = null;
  }
}


function updateTimer() {

  if (!examActive) {
    return;
  }


  updateTimerDisplay();
}


function updateTimerDisplay() {

  const timer =
    getElement("timer");


  if (!timer) {
    return;
  }


  const totalSeconds =
    Math.max(
      0,
      remainingSeconds
    );


  const minutes =
    Math.floor(
      totalSeconds / 60
    );


  const seconds =
    totalSeconds % 60;


  timer.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;


  timer.classList.remove(
    "warning",
    "danger"
  );


  if (totalSeconds <= 300) {

    timer.classList.add(
      "danger"
    );

  } else if (totalSeconds <= 600) {

    timer.classList.add(
      "warning"
    );
  }
}


/* =========================================================
   TIME EXPIRY
   ========================================================= */

async function handleTimeExpired() {

  if (
    !examActive ||
    examSubmitting
  ) {
    return;
  }


  alert(
    "Your examination time has expired. Your examination will now be submitted."
  );


  await submitExam(
    true
  );
}


/* =========================================================
   RENDER QUESTION
   ========================================================= */

function renderQuestion() {

  if (
    !questions.length ||
    !questions[currentQuestion]
  ) {
    return;
  }


  const question =
    questions[currentQuestion];


  const questionNumber =
    currentQuestion + 1;


  setText(
    "questionNumber",
    `Question ${questionNumber} of ${questions.length}`
  );


  setText(
    "questionText",
    question.question ??
    question.questionText ??
    question.text ??
    ""
  );


  renderOptions(
    question
  );


  updateNavigationButtons();

  renderQuestionNavigator();

  updateReviewButton();
}


/* =========================================================
   RENDER OPTIONS
   ========================================================= */

function renderOptions(question) {

  const container =
    getElement("optionsContainer");


  if (!container) {
    return;
  }


  container.innerHTML = "";


  /*
   * The backend may return:
   *
   * options: [...]
   *
   * or:
   *
   * choices: [...]
   */
  let options =
    question.options ??
    question.choices ??
    [];


  /*
   * Support object-form options:
   *
   * {
   *   A: "Option A",
   *   B: "Option B",
   *   C: "Option C",
   *   D: "Option D"
   * }
   */
  if (
    !Array.isArray(options) &&
    typeof options === "object" &&
    options !== null
  ) {

    options =
      Object.entries(options).map(
        function([letter, text]) {

          return {
            letter: letter,
            text: text
          };

        }
      );
  }


  if (!Array.isArray(options)) {

    options = [];
  }


  const questionId =
    getQuestionId(question);


  const questionType =
    String(
      question.type ??
      question.questionType ??
      "mc"
    ).toLowerCase();


  options.forEach(
    function(option, index) {

      let letter;

      let text;


      if (
        typeof option === "string"
      ) {

        letter =
          String.fromCharCode(
            65 + index
          );

        text =
          option;

      } else {

        letter =
          option.letter ??
          option.key ??
          option.value ??
          String.fromCharCode(
            65 + index
          );

        text =
          option.text ??
          option.label ??
          option.option ??
          option.value ??
          "";
      }


      letter =
        String(letter)
          .trim()
          .toUpperCase();


      const optionId =
        `question_${questionId}_${letter}`;


      const wrapper =
        document.createElement("div");


      wrapper.className =
        "option";


      const input =
        document.createElement("input");


      input.type =
        questionType === "cb" ||
        questionType === "checkbox" ||
        questionType === "multiple"
          ? "checkbox"
          : "radio";


      input.name =
        `question_${questionId}`;


      input.value =
        letter;


      input.id =
        optionId;


      input.checked =
        hasAnswer(
          questionId,
          letter
        );


      const optionLetter =
        document.createElement("span");


      optionLetter.className =
        "option-letter";


      optionLetter.textContent =
        letter;


      const label =
        document.createElement("label");


      label.htmlFor =
        optionId;


      label.textContent =
        text;


      wrapper.appendChild(
        input
      );


      wrapper.appendChild(
        optionLetter
      );


      wrapper.appendChild(
        label
      );


      if (input.checked) {

        wrapper.classList.add(
          "selected"
        );
      }


      input.addEventListener(
        "change",
        function() {

          saveAnswer(
            question,
            letter,
            input.checked
          );


          wrapper.classList.toggle(
            "selected",
            input.checked
          );


          renderQuestionNavigator();
        }
      );


      container.appendChild(
        wrapper
      );

    }
  );
}


/* =========================================================
   GET QUESTION ID
   ========================================================= */

function getQuestionId(question) {

  return String(
    question.questionId ??
    question.id ??
    question.ID ??
    question.number ??
    currentQuestion + 1
  );
}


/* =========================================================
   SAVE ANSWER
   ========================================================= */

function saveAnswer(
  question,
  letter,
  checked
) {

  const questionId =
    getQuestionId(question);


  const questionType =
    String(
      question.type ??
      question.questionType ??
      "mc"
    ).toLowerCase();


  /*
   * Multiple-choice / radio
   */
  if (
    questionType !== "cb" &&
    questionType !== "checkbox" &&
    questionType !== "multiple"
  ) {

    if (checked) {

      answers[questionId] =
        letter;

    } else if (
      answers[questionId] === letter
    ) {

      delete answers[questionId];
    }


    return;
  }


  /*
   * Checkbox / multiple-answer question
   */
  let currentAnswers =
    answers[questionId];


  if (!Array.isArray(currentAnswers)) {

    currentAnswers =
      currentAnswers
        ? String(
            currentAnswers
          )
          .split(",")
          .map(
            value =>
              value.trim()
          )
          .filter(Boolean)
        : [];
  }


  if (checked) {

    if (
      !currentAnswers.includes(
        letter
      )
    ) {

      currentAnswers.push(
        letter
      );
    }

  } else {

    currentAnswers =
      currentAnswers.filter(
        value =>
          value !== letter
      );
  }


  currentAnswers.sort();


  if (currentAnswers.length) {

    answers[questionId] =
      currentAnswers;

  } else {

    delete answers[questionId];
  }
}


/* =========================================================
   CHECK ANSWER
   ========================================================= */

function hasAnswer(
  questionId,
  letter
) {

  const answer =
    answers[questionId];


  if (Array.isArray(answer)) {

    return answer.includes(
      String(letter).toUpperCase()
    );
  }


  return String(
    answer ?? ""
  ).toUpperCase() ===
    String(letter).toUpperCase();
}


/* =========================================================
   NEXT QUESTION
   ========================================================= */

function nextQuestion() {

  if (
    currentQuestion <
    questions.length - 1
  ) {

    currentQuestion++;

    renderQuestion();

    scrollExamToTop();

  } else {

    /*
     * At the final question we don't automatically
     * submit. The student must explicitly submit.
     */
    renderQuestion();

    alert(
      "You are on the final question. Review your answers and submit the examination when you are ready."
    );
  }
}


/* =========================================================
   PREVIOUS QUESTION
   ========================================================= */

function previousQuestion() {

  if (
    currentQuestion > 0
  ) {

    currentQuestion--;

    renderQuestion();

    scrollExamToTop();
  }
}


/* =========================================================
   GO TO QUESTION
   ========================================================= */

function goToQuestion(index) {

  if (
    index < 0 ||
    index >= questions.length
  ) {
    return;
  }


  currentQuestion =
    index;


  renderQuestion();

  scrollExamToTop();
}


/* =========================================================
   SCROLL EXAM TO TOP
   ========================================================= */

function scrollExamToTop() {

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================================================
   UPDATE NAVIGATION BUTTONS
   ========================================================= */

function updateNavigationButtons() {

  const previousButton =
    getElement("previousButton");

  const nextButton =
    getElement("nextButton");


  if (previousButton) {

    previousButton.disabled =
      currentQuestion <= 0;
  }


  if (nextButton) {

    nextButton.disabled =
      currentQuestion >=
      questions.length - 1;
  }
}


/* =========================================================
   TOGGLE REVIEW
   ========================================================= */

function toggleReview() {

  if (!questions[currentQuestion]) {
    return;
  }


  const questionId =
    getQuestionId(
      questions[currentQuestion]
    );


  reviewed[questionId] =
    !reviewed[questionId];


  updateReviewButton();

  renderQuestionNavigator();
}


/* =========================================================
   UPDATE REVIEW BUTTON
   ========================================================= */

function updateReviewButton() {

  const button =
    getElement("reviewButton");


  if (!button) {
    return;
  }


  if (!questions[currentQuestion]) {

    button.textContent =
      "☆ Mark for Review";

    return;
  }


  const questionId =
    getQuestionId(
      questions[currentQuestion]
    );


  if (reviewed[questionId]) {

    button.textContent =
      "★ Marked for Review";

    button.classList.add(
      "active"
    );

  } else {

    button.textContent =
      "☆ Mark for Review";

    button.classList.remove(
      "active"
    );
  }
}


/* =========================================================
   RENDER QUESTION NAVIGATOR
   ========================================================= */

function renderQuestionNavigator() {

  const navigator =
    getElement(
      "questionNavigator"
    );


  if (!navigator) {
    return;
  }


  navigator.innerHTML = "";


  questions.forEach(
    function(question, index) {

      const questionId =
        getQuestionId(
          question
        );


      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "question-number";


      button.textContent =
        index + 1;


      const answer =
        answers[questionId];


      const hasAnyAnswer =
        Array.isArray(answer)
          ? answer.length > 0
          : Boolean(answer);


      if (hasAnyAnswer) {

        button.classList.add(
          "answered"
        );
      }


      if (
        reviewed[questionId]
      ) {

        button.classList.add(
          "review"
        );
      }


      if (
        index ===
        currentQuestion
      ) {

        button.classList.add(
          "current"
        );
      }


      button.addEventListener(
        "click",
        function() {

          goToQuestion(
            index
          );

        }
      );


      navigator.appendChild(
        button
      );

    }
  );
}


/* =========================================================
   CONFIRM SUBMIT
   ========================================================= */

function confirmSubmit() {

  if (
    !examActive ||
    examSubmitting
  ) {
    return;
  }


  const modal =
    getElement(
      "confirmModal"
    );


  if (modal) {

    modal.classList.remove(
      "hidden"
    );

  } else {

    const confirmed =
      window.confirm(
        "Are you sure you want to submit your examination? You will not be able to change your answers after submission."
      );


    if (confirmed) {

      submitExam();
    }
  }
}


/* =========================================================
   CLOSE CONFIRM MODAL
   ========================================================= */

function closeConfirmModal() {

  const modal =
    getElement(
      "confirmModal"
    );


  if (modal) {

    modal.classList.add(
      "hidden"
    );
  }
}


/* =========================================================
   SUBMIT EXAM
   ========================================================= */

/**
 * Submit examination.
 *
 * @param {boolean} automatic
 */
async function submitExam(
  automatic = false
) {

  if (
    examSubmitting ||
    !attemptId
  ) {
    return;
  }


  examSubmitting = true;


  closeConfirmModal();


  stopTimer();


  try {

    showLoading(
      automatic
        ? "Submitting your examination..."
        : "Submitting examination..."
    );


    /*
     * Convert the internal answers object into
     * a clean server-friendly format.
     *
     * Example:
     *
     * {
     *   "1": "A",
     *   "2": ["B", "D"],
     *   "3": "C"
     * }
     */
    const formattedAnswers =
      formatAnswersForSubmission();


    /*
     * IMPORTANT:
     *
     * The frontend does NOT calculate the score.
     *
     * The server must:
     *
     * - retrieve the correct answers
     * - validate the attempt
     * - calculate the score
     * - reject duplicate submissions
     * - check expiry
     * - save answers
     * - mark the attempt as submitted
     */


    const result =
      await api(
        "submitAttempt",
        {
          attemptId:
            attemptId,

          answers:
            formattedAnswers
        }
      );


    /*
     * Examination is now finished.
     */
    examActive = false;

    examSubmitting = false;

    document.body.classList.remove(
      "exam-mode"
    );


    attemptId = null;


    /*
     * Exit fullscreen if possible.
     */
    exitFullscreen();


    /*
     * Display result.
     */
    displayResult(
      result
    );


    showScreen(
      "resultScreen"
    );


  } catch (error) {

    console.error(
      "SUBMIT EXAM ERROR:",
      error
    );


    examSubmitting = false;


    /*
     * If submission failed because the attempt
     * has already been submitted or terminated,
     * don't simply allow the student to continue.
     */
    const message =
      error.message ||
      "Unable to submit your examination.";


    alert(
      message
    );


  } finally {

    hideLoading();
  }
}


/* =========================================================
   FORMAT ANSWERS
   ========================================================= */

function formatAnswersForSubmission() {

  const formatted = {};


  Object.keys(answers).forEach(
    function(questionId) {

      const answer =
        answers[questionId];


      if (Array.isArray(answer)) {

        formatted[questionId] =
          answer
            .map(
              value =>
                String(value)
                  .trim()
                  .toUpperCase()
            )
            .filter(Boolean)
            .sort()
            .join(",");

      } else {

        formatted[questionId] =
          String(answer)
            .trim()
            .toUpperCase();
      }

    }
  );


  return formatted;
}


/* =========================================================
   DISPLAY RESULT
   ========================================================= */

function displayResult(
  result
) {

  if (!result) {

    setText(
      "resultScore",
      "Submitted"
    );


    setText(
      "resultPercentage",
      "—"
    );


    return;
  }


  const score =
    result.score ??
    result.totalScore ??
    result.marks ??
    0;


  const total =
    result.totalMarks ??
    result.totalQuestions ??
    result.total ??
    questions.length;


  let percentage =
    result.percentage;


  if (
    percentage === undefined ||
    percentage === null
  ) {

    if (
      Number(total) > 0
    ) {

      percentage =
        (
          Number(score) /
          Number(total)
        ) *
        100;

    } else {

      percentage = 0;
    }
  }


  setText(
    "resultScore",
    `${score} / ${total}`
  );


  setText(
    "resultPercentage",
    `${Number(percentage).toFixed(1)}%`
  );
}


/* =========================================================
   SHOW SCREEN
   ========================================================= */

function showScreen(
  screenId
) {

  const screens =
    document.querySelectorAll(
      ".screen"
    );


  screens.forEach(
    function(screen) {

      screen.classList.add(
        "hidden"
      );
    }
  );


  const target =
    getElement(
      screenId
    );


  if (target) {

    target.classList.remove(
      "hidden"
    );
  }


  window.scrollTo({
    top: 0,
    behavior: "instant"
  });
}


/* =========================================================
   SHOW DASHBOARD
   ========================================================= */

async function showDashboard() {

  /*
   * Do not allow the student to navigate away from
   * an active examination using the dashboard.
   */
  if (examActive) {

    alert(
      "You cannot return to the dashboard while an examination is in progress."
    );

    return;
  }


  selectedBook = null;


  showScreen(
    "dashboardScreen"
  );


  /*
   * Refresh the book list.
   */
  if (currentStudent) {

    try {

      await loadBooks();

    } catch (error) {

      console.error(
        error
      );
    }
  }
}


/* =========================================================
   LOGOUT
   ========================================================= */

function logout() {

  if (examActive) {

    alert(
      "You cannot logout while an examination is in progress."
    );

    return;
  }


  currentStudent = null;

  books = [];

  selectedBook = null;

  questions = [];

  answers = {};

  reviewed = {};

  attemptId = null;


  stopTimer();


  try {

    sessionStorage.removeItem(
      "brp_student"
    );

  } catch (error) {

    console.warn(
      "Unable to clear session storage.",
      error
    );
  }


  const studentId =
    getElement(
      "studentId"
    );


  const studentPin =
    getElement(
      "studentPin"
    );


  const loginMessage =
    getElement(
      "loginMessage"
    );


  if (studentId) {
    studentId.value = "";
  }


  if (studentPin) {
    studentPin.value = "";
  }


  if (loginMessage) {
    loginMessage.textContent = "";
  }


  showScreen(
    "loginScreen"
  );
}


/* =========================================================
   RESTORE LOGIN SESSION
   ========================================================= */

function restoreStudentSession() {

  try {

    const saved =
      sessionStorage.getItem(
        "brp_student"
      );


    if (!saved) {
      return;
    }


    const student =
      JSON.parse(
        saved
      );


    if (!student) {
      return;
    }


    /*
     * Restore only the student identity.
     * We do not store PINs.
     */
    currentStudent =
      student;


    setText(
      "studentName",
      getStudentName(
        currentStudent
      )
    );


    /*
     * The student still needs to return to
     * the dashboard. Books will be requested
     * from the backend.
     */
    loadBooks()
      .then(
        function() {

          showScreen(
            "dashboardScreen"
          );

        }
      )
      .catch(
        function(error) {

          console.error(
            "SESSION RESTORE ERROR:",
            error
          );

          logout();

        }
      );

  } catch (error) {

    console.error(
      "SESSION RESTORE ERROR:",
      error
    );


    try {

      sessionStorage.removeItem(
        "brp_student"
      );

    } catch (storageError) {
      // Ignore.
    }
  }
}


/* =========================================================
   EXAM SECURITY
   ========================================================= */

/*
 * Browser-level examination protections.
 *
 * These are NOT absolute security controls.
 *
 * A determined student may still:
 *
 * - use another device
 * - use browser developer tools
 * - use virtualization
 * - photograph the screen
 * - bypass JavaScript
 *
 * Therefore the backend remains authoritative.
 */

function setupExamSecurity() {

  removeExamSecurityListeners();


  /*
   * Prevent context menu.
   */
  document.addEventListener(
    "contextmenu",
    preventExamContextMenu
  );


  /*
   * Prevent selecting/copying text.
   */
  document.addEventListener(
    "copy",
    preventExamCopy
  );


  document.addEventListener(
    "cut",
    preventExamCopy
  );


  document.addEventListener(
    "selectstart",
    preventExamSelection
  );


  /*
   * Keyboard restrictions.
   */
  document.addEventListener(
    "keydown",
    preventExamKeyboard
  );


  /*
   * Detect when the browser tab becomes hidden.
   */
  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );


  /*
   * Detect browser window losing focus.
   */
  window.addEventListener(
    "blur",
    handleWindowBlur
  );


  /*
   * Warn when attempting to leave/reload.
   *
   * This does NOT replace server-side protection.
   */
  window.addEventListener(
    "beforeunload",
    handleBeforeUnload
  );
}


/* =========================================================
   REMOVE SECURITY LISTENERS
   ========================================================= */

function removeExamSecurityListeners() {

  document.removeEventListener(
    "contextmenu",
    preventExamContextMenu
  );


  document.removeEventListener(
    "copy",
    preventExamCopy
  );


  document.removeEventListener(
    "cut",
    preventExamCopy
  );


  document.removeEventListener(
    "selectstart",
    preventExamSelection
  );


  document.removeEventListener(
    "keydown",
    preventExamKeyboard
  );


  document.removeEventListener(
    "visibilitychange",
    handleVisibilityChange
  );


  window.removeEventListener(
    "blur",
    handleWindowBlur
  );


  window.removeEventListener(
    "beforeunload",
    handleBeforeUnload
  );
}


/* =========================================================
   PREVENT CONTEXT MENU
   ========================================================= */

function preventExamContextMenu(event) {

  if (examActive) {

    event.preventDefault();
  }
}


/* =========================================================
   PREVENT COPY
   ========================================================= */

function preventExamCopy(event) {

  if (examActive) {

    event.preventDefault();

    showTemporarySecurityMessage(
      "Copying examination content is disabled."
    );
  }
}


/* =========================================================
   PREVENT SELECTION
   ========================================================= */

function preventExamSelection(event) {

  if (examActive) {

    event.preventDefault();
  }
}


/* =========================================================
   PREVENT KEYBOARD SHORTCUTS
   ========================================================= */

function preventExamKeyboard(event) {

  if (!examActive) {
    return;
  }


  const key =
    String(
      event.key || ""
    ).toLowerCase();


  /*
   * Ctrl / Cmd shortcuts.
   */
  if (
    (event.ctrlKey || event.metaKey) &&
    [
      "c",
      "x",
      "a",
      "u",
      "s",
      "p"
    ].includes(key)
  ) {

    event.preventDefault();

    showTemporarySecurityMessage(
      "This keyboard action is disabled during the examination."
    );

    return;
  }


  /*
   * Developer tools shortcuts.
   *
   * These are only deterrents.
   */
  if (
    key === "f12" ||
    (
      event.ctrlKey &&
      event.shiftKey &&
      [
        "i",
        "j",
        "c"
      ].includes(key)
    )
  ) {

    event.preventDefault();

    showTemporarySecurityMessage(
      "This keyboard action is disabled during the examination."
    );

    return;
  }


  /*
   * PrintScreen cannot reliably be prevented
   * by a web browser.
   *
   * We can at least clear focus/selection.
   */
  if (
    key === "printscreen"
  ) {

    event.preventDefault();

    window.getSelection()?.removeAllRanges();

    showTemporarySecurityMessage(
      "Screen capture is restricted during the examination."
    );
  }


  /*
   * Escape can be used to leave fullscreen.
   *
   * We don't attempt to prevent it because browsers
   * intentionally reserve certain security controls.
   */
}


/* =========================================================
   VISIBILITY CHANGE
   ========================================================= */

function handleVisibilityChange() {

  if (
    !examActive ||
    examSubmitting
  ) {
    return;
  }


  if (
    document.visibilityState ===
    "hidden"
  ) {

    /*
     * This is a deliberate strict rule:
     *
     * leaving the examination tab terminates
     * the examination.
     *
     * The backend will ultimately be responsible
     * for recording the attempt state.
     */
    terminateExamForLeaving(
      "You left the examination page. Your examination has been terminated."
    );
  }
}


/* =========================================================
   WINDOW BLUR
   ========================================================= */

function handleWindowBlur() {

  if (
    !examActive ||
    examSubmitting
  ) {
    return;
  }


  /*
   * We intentionally don't immediately terminate
   * on blur alone because browsers can trigger blur
   * for legitimate UI interactions.
   *
   * The visibilitychange event is the primary
   * leave-page detector.
   */
}


/* =========================================================
   BEFORE UNLOAD
   ========================================================= */

function handleBeforeUnload(event) {

  if (
    !examActive ||
    examSubmitting
  ) {
    return;
  }


  /*
   * Browser displays its own confirmation dialog.
   *
   * Custom text is generally ignored by modern browsers.
   */
  event.preventDefault();

  event.returnValue = "";
}


/* =========================================================
   TERMINATE EXAM FOR LEAVING
   ========================================================= */

async function terminateExamForLeaving(
  message
) {

  if (
    !examActive ||
    examSubmitting ||
    examTerminated
  ) {
    return;
  }


  examTerminated = true;

  examSubmitting = true;


  stopTimer();


  try {

    /*
     * Tell the backend that this attempt was
     * terminated.
     *
     * This action will be implemented in Code.gs.
     *
     * We intentionally don't depend on this request
     * succeeding before locking the frontend.
     */
    await api(
      "terminateAttempt",
      {
        attemptId:
          attemptId,

        reason:
          "STUDENT_LEFT_EXAM"
      }
    );

  } catch (error) {

    console.error(
      "TERMINATE ATTEMPT ERROR:",
      error
    );

  } finally {

    examActive = false;

    examSubmitting = false;

    document.body.classList.remove(
      "exam-mode"
    );


    removeExamSecurityListeners();


    exitFullscreen();


    attemptId = null;


    showExamTerminationScreen(
      message
    );
  }
}


/* =========================================================
   EXAM TERMINATION SCREEN
   ========================================================= */

function showExamTerminationScreen(
  message
) {

  /*
   * We use a modal-style overlay rather than silently
   * returning to the dashboard.
   */
  const existing =
    document.querySelector(
      ".exam-warning"
    );


  if (existing) {

    existing.remove();
  }


  const wrapper =
    document.createElement(
      "div"
    );


  wrapper.className =
    "exam-warning";


  wrapper.innerHTML = `
    <div class="exam-warning-card">

      <div class="modal-icon">
        !
      </div>

      <h2>
        Examination Terminated
      </h2>

      <p>
        ${escapeHtml(message)}
      </p>

      <br>

      <button
        type="button"
        class="primary-btn"
        id="terminationReturnButton"
      >
        Return to Login
      </button>

    </div>
  `;


  document.body.appendChild(
    wrapper
  );


  const button =
    document.getElementById(
      "terminationReturnButton"
    );


  if (button) {

    button.addEventListener(
      "click",
      function() {

        wrapper.remove();

        logout();

      }
    );
  }
}


/* =========================================================
   TEMPORARY SECURITY MESSAGE
   ========================================================= */

let securityMessageTimeout = null;


function showTemporarySecurityMessage(
  message
) {

  let element =
    document.getElementById(
      "securityMessage"
    );


  if (!element) {

    element =
      document.createElement(
        "div"
      );


    element.id =
      "securityMessage";


    element.style.position =
      "fixed";


    element.style.left =
      "50%";


    element.style.bottom =
      "25px";


    element.style.transform =
      "translateX(-50%)";


    element.style.zIndex =
      "2000";


    element.style.padding =
      "12px 18px";


    element.style.borderRadius =
      "8px";


    element.style.background =
      "#083c28";


    element.style.color =
      "#ffffff";


    element.style.fontSize =
      "13px";


    element.style.fontWeight =
      "600";


    element.style.boxShadow =
      "0 8px 25px rgba(0,0,0,0.2)";


    element.style.maxWidth =
      "90%";


    element.style.textAlign =
      "center";


    document.body.appendChild(
      element
    );
  }


  element.textContent =
    message;


  element.style.display =
    "block";


  clearTimeout(
    securityMessageTimeout
  );


  securityMessageTimeout =
    setTimeout(
      function() {

        element.style.display =
          "none";

      },
      2500
    );
}


/* =========================================================
   FULLSCREEN
   ========================================================= */

async function requestFullscreen() {

  try {

    if (
      document.fullscreenElement
    ) {
      return;
    }


    const element =
      document.documentElement;


    if (
      element.requestFullscreen
    ) {

      await element.requestFullscreen();
    }

  } catch (error) {

    /*
     * Fullscreen can be rejected by the browser.
     * This should never prevent the examination.
     */
    console.warn(
      "Fullscreen request was not accepted.",
      error
    );
  }
}


/* =========================================================
   EXIT FULLSCREEN
   ========================================================= */

async function exitFullscreen() {

  try {

    if (
      document.fullscreenElement &&
      document.exitFullscreen
    ) {

      await document.exitFullscreen();
    }

  } catch (error) {

    console.warn(
      "Unable to exit fullscreen.",
      error
    );
  }
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";
  }


  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  function() {

    /*
     * Start on the login screen.
     */
    showScreen(
      "loginScreen"
    );


    /*
     * Allow Enter key to submit login.
     */
    const studentId =
      getElement(
        "studentId"
      );


    const studentPin =
      getElement(
        "studentPin"
      );


    if (studentId) {

      studentId.addEventListener(
        "keydown",
        function(event) {

          if (
            event.key ===
            "Enter"
          ) {

            event.preventDefault();

            login();
          }
        }
      );
    }


    if (studentPin) {

      studentPin.addEventListener(
        "keydown",
        function(event) {

          if (
            event.key ===
            "Enter"
          ) {

            event.preventDefault();

            login();
          }
        }
      );
    }


    /*
     * Restore an existing login session if available.
     */
    restoreStudentSession();

  }
);