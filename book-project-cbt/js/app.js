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
let interruptionInProgress = false;
let interruptionStartedAt = null;
let interruptionDetectionTimer = null;
let answerSyncInterval = null;
let answerSyncInFlight = false;
let lastAnswerSyncAt = 0;
let dirtyAnswerVersions = {};
let answerVersionCounter = 0;
const ANSWER_SYNC_INTERVAL_MS = 15000;
const ANSWER_SYNC_MIN_MS = 10000;
const INTERRUPTION_GRACE_MS = 30000;


/* =========================================================
   API HELPER
   ========================================================= */

async function api(
  action,
  data = {}
) {

  try {

    const response =
      await fetch(
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
        // Keep original error.
      }


      throw new Error(
        errorMessage
      );
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

  return document.getElementById(
    id
  );
}


function setText(
  id,
  value
) {

  const element =
    getElement(id);


  if (element) {

    element.textContent =
      value ?? "";
  }
}


function showLoading(
  message = "Please wait..."
) {

  const overlay =
    getElement(
      "loadingOverlay"
    );


  const loadingMessage =
    getElement(
      "loadingMessage"
    );


  if (loadingMessage) {

    loadingMessage.textContent =
      message;
  }


  if (overlay) {

    overlay.classList.remove(
      "hidden"
    );
  }
}


function hideLoading() {

  const overlay =
    getElement(
      "loadingOverlay"
    );


  if (overlay) {

    overlay.classList.add(
      "hidden"
    );
  }
}


/* =========================================================
   LOGIN
   ========================================================= */

async function login() {

  const studentIdElement =
    getElement(
      "studentId"
    );


  const pinElement =
    getElement(
      "studentPin"
    );


  const messageElement =
    getElement(
      "loginMessage"
    );


  if (
    !studentIdElement ||
    !pinElement
  ) {

    return;
  }


  const studentId =
    studentIdElement.value.trim();


  const pin =
    pinElement.value.trim();


  if (messageElement) {

    messageElement.textContent =
      "";
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

    showLoading(
      "Verifying your details..."
    );


    const result =
      await api(
        "loginStudent",
        {
          studentId:
            studentId,

          pin:
            pin
        }
      );


    if (
      !result ||
      result.success === false
    ) {

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


    saveStudentSession(
      currentStudent
    );


    setText(
      "studentName",
      getStudentName(
        currentStudent
      )
    );


    /*
     * The recovery endpoint is now a single server request
     * instead of one request per available book.
     */
    await loadBooks();
    const resumed = await attemptExamRecovery();


    if (!resumed) {

      showScreen(
        "dashboardScreen"
      );
    }


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

function getStudentName(
  student
) {

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
   STUDENT SESSION
   ========================================================= */

function saveStudentSession(
  student
) {

  try {

    sessionStorage.setItem(
      "brp_student",
      JSON.stringify(
        student
      )
    );

  } catch (error) {

    console.warn(
      "Unable to save student session.",
      error
    );
  }
}


/* =========================================================
   LOAD BOOKS
   ========================================================= */

async function loadBooks() {

  try {

    showLoading(
      "Loading available books..."
    );


    const result =
      await api(
        "getBooks"
      );


    if (
      Array.isArray(
        result
      )
    ) {

      books =
        result;

    } else if (
      result &&
      Array.isArray(
        result.books
      )
    ) {

      books =
        result.books;

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
      getElement(
        "booksContainer"
      );


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
    getElement(
      "booksContainer"
    );


  if (!container) {

    return;
  }


  container.innerHTML =
    "";


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


  books.forEach(
    function(book, index) {

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
        document.createElement(
          "article"
        );


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
        card.querySelector(
          "button"
        );


      if (button) {

        button.addEventListener(
          "click",
          function() {

            openBook(
              bookId
            );

          }
        );
      }


      container.appendChild(
        card
      );

    }
  );
}


/* =========================================================
   OPEN BOOK
   ========================================================= */

async function openBook(
  bookId
) {

  try {

    showLoading(
      "Loading book information..."
    );


    let book =
      books.find(
        function(item) {

          return String(
            item.bookId ??
            item.id ??
            item.ID
          ) ===
          String(
            bookId
          );

        }
      );


    if (!book) {

      const result =
        await api(
          "getBook",
          {
            bookId:
              bookId
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


    showScreen(
      "bookScreen"
    );


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


    showScreen(
      "loginScreen"
    );


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


    const studentId =
      currentStudent.studentId ??
      currentStudent.id ??
      currentStudent.ID;


    const bookId =
      selectedBook.bookId ??
      selectedBook.id ??
      selectedBook.ID;


    const attemptResult =
      await api(
        "startAttempt",
        {
          studentId:
            studentId,

          bookId:
            bookId
        }
      );


    if (!attemptResult) {

      throw new Error(
        "The examination attempt could not be created."
      );
    }


    await initializeExamFromAttempt(
      attemptResult,
      selectedBook,
      false
    );


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
   EXAM RECOVERY
   ========================================================= */

/**
 * Checks whether the logged-in student already has
 * an active attempt.
 *
 * Returns true when an exam was successfully resumed.
 */
async function attemptExamRecovery() {

  if (!currentStudent) {
    return false;
  }

  const studentId =
    currentStudent.studentId ??
    currentStudent.id ??
    currentStudent.ID;

  if (!studentId) {
    return false;
  }

  try {
    const activeResult = await api(
      "getActiveAttemptForStudent",
      { studentId: studentId }
    );

    if (
      activeResult &&
      activeResult.hasActiveAttempt
    ) {
      selectedBook = activeResult.book || null;

      if (!selectedBook) {
        throw new Error("The active examination book could not be identified.");
      }

      await initializeExamFromAttempt(
        activeResult,
        selectedBook,
        true
      );

      return true;
    }

    return false;

  } catch (error) {
    console.error(
      "EXAM RECOVERY ERROR:",
      error
    );

    /*
     * Recovery failure must not terminate the student's
     * session. They can still use the dashboard.
     */
    return false;
  }
}

/* =========================================================
   INITIALIZE EXAM FROM ATTEMPT
   ========================================================= */

/**
 * Builds the exam UI from a server-authoritative attempt.
 *
 * Used for BOTH:
 *
 * 1. Newly started exams.
 * 2. Recovered exams after refresh.
 */
async function initializeExamFromAttempt(
  attemptResult,
  book,
  isRecovery = false
) {

  if (!attemptResult) {

    throw new Error(
      "Invalid examination attempt."
    );
  }


  const recoveredAttemptId =
    attemptResult.attemptId ??
    attemptResult.id ??
    attemptResult.attemptID;


  if (!recoveredAttemptId) {

    throw new Error(
      "The examination attempt ID was not returned."
    );
  }


  attemptId =
    String(
      recoveredAttemptId
    );


  selectedBook =
    book;


  /*
   * Load the questions again.
   *
   * Correct answers are never returned by getQuestions().
   */
  const bookId =
    selectedBook.bookId ??
    selectedBook.id ??
    selectedBook.ID;


  const questionResult =
    await api(
      "getQuestions",
      {
        bookId:
          bookId
      }
    );


  if (
    Array.isArray(
      questionResult
    )
  ) {

    questions =
      questionResult;

  } else if (
    questionResult &&
    Array.isArray(
      questionResult.questions
    )
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
   * Reset temporary state for a NEW exam.
   *
   * For a RECOVERED exam, restore the state from
   * sessionStorage if it belongs to this same attempt.
   */
  if (isRecovery) {

    restoreExamSession(
      attemptId
    );

  } else {

    currentQuestion =
      0;

    answers =
      {};

    reviewed =
      {};

    clearExamSession();
  }


  /*
   * Server-authoritative expiration.
   *
   * We calculate remaining time from ExpiresAt rather
   * than trusting a browser timer.
   */
  const expiresAt =
    attemptResult.expiresAt
      ? new Date(
          attemptResult.expiresAt
        )
      : null;


  if (
    !expiresAt ||
    isNaN(
      expiresAt.getTime()
    )
  ) {

    /*
     * Fallback for safety.
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
        Math.floor(
          duration * 60
        )
      );

  } else {

    remainingSeconds =
      Math.max(
        0,
        Math.floor(
          (
            expiresAt.getTime() -
            Date.now()
          ) / 1000
        )
      );
  }


  if (
    remainingSeconds <= 0
  ) {

    throw new Error(
      "This examination attempt has expired."
    );
  }


  /*
   * Clamp current question.
   */
  if (
    currentQuestion < 0 ||
    currentQuestion >= questions.length
  ) {

    currentQuestion =
      0;
  }


  examSubmitting =
    false;


  examTerminated =
    false;


  visibilityWarningShown =
    false;


  examActive =
    true;

  /* Do not treat answers restored from the local session as new changes. */
  dirtyAnswerVersions = {};
  answerVersionCounter = 0;
  lastAnswerSyncAt = 0;


  document.body.classList.add(
    "exam-mode"
  );


  renderQuestionNavigator();

  renderQuestion();

  updateTimerDisplay();

  startTimer();

  setupExamSecurity();
  startAnswerSync();

  showScreen(
    "examScreen"
  );


  /*
   * Try fullscreen.
   */
  requestFullscreen();


  /*
   * Tell the student what happened after a refresh.
   */
  if (isRecovery) {

    showTemporarySecurityMessage(
      "Your active examination has been restored."
    );
  }
}


/* =========================================================
   EXAM SESSION STORAGE
   ========================================================= */

/**
 * We store ONLY temporary exam state:
 *
 * - Attempt ID
 * - Book ID
 * - Current question
 * - Answers
 * - Reviewed questions
 *
 * We NEVER store:
 *
 * - PIN
 * - Correct answers
 * - Score
 * - Server-side examination result
 */
function getExamStorageKey(
  id = attemptId
) {

  if (!id) {

    return null;
  }


  return (
    "brp_exam_" +
    String(id)
  );
}


function saveExamSession() {

  const key =
    getExamStorageKey();


  if (!key) {

    return;
  }


  try {

    const state = {

      attemptId:
        attemptId,

      bookId:
        selectedBook
          ? String(
              selectedBook.bookId ??
              selectedBook.id ??
              selectedBook.ID ??
              ""
            )
          : "",

      currentQuestion:
        currentQuestion,

      answers:
        answers,

      reviewed:
        reviewed
    };


    sessionStorage.setItem(
      key,
      JSON.stringify(
        state
      )
    );

  } catch (error) {

    console.warn(
      "Unable to save exam session.",
      error
    );
  }
}


function restoreExamSession(
  expectedAttemptId
) {

  currentQuestion =
    0;

  answers =
    {};

  reviewed =
    {};


  const key =
    getExamStorageKey(
      expectedAttemptId
    );


  if (!key) {

    return;
  }


  try {

    const saved =
      sessionStorage.getItem(
        key
      );


    if (!saved) {

      return;
    }


    const state =
      JSON.parse(
        saved
      );


    if (!state) {

      return;
    }


    if (
      String(
        state.attemptId
      ) !==
      String(
        expectedAttemptId
      )
    ) {

      return;
    }


    /*
     * Verify the saved book matches the active book.
     */
    const activeBookId =
      selectedBook
        ? String(
            selectedBook.bookId ??
            selectedBook.id ??
            selectedBook.ID ??
            ""
          )
        : "";


    if (
      state.bookId &&
      activeBookId &&
      String(
        state.bookId
      ) !== activeBookId
    ) {

      return;
    }


    if (
      Number.isInteger(
        state.currentQuestion
      )
    ) {

      currentQuestion =
        state.currentQuestion;
    }


    if (
      state.answers &&
      typeof state.answers ===
        "object"
    ) {

      answers =
        state.answers;
    }


    if (
      state.reviewed &&
      typeof state.reviewed ===
        "object"
    ) {

      reviewed =
        state.reviewed;
    }


  } catch (error) {

    console.warn(
      "Unable to restore exam session.",
      error
    );
  }
}


function clearExamSession(
  id = attemptId
) {

  const key =
    getExamStorageKey(
      id
    );


  if (!key) {

    return;
  }


  try {

    sessionStorage.removeItem(
      key
    );

  } catch (error) {

    console.warn(
      "Unable to clear exam session.",
      error
    );
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


        /*
         * Keep the current answer state available
         * if the browser is refreshed.
         */
        saveExamSession();


        if (
          remainingSeconds <= 0
        ) {

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


    timerInterval =
      null;
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
    getElement(
      "timer"
    );


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
      totalSeconds /
      60
    );


  const seconds =
    totalSeconds %
    60;


  timer.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;


  timer.classList.remove(
    "warning",
    "danger"
  );


  if (
    totalSeconds <= 300
  ) {

    timer.classList.add(
      "danger"
    );

  } else if (
    totalSeconds <= 600
  ) {

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
    questions[
      currentQuestion
    ];


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


  /*
   * Save navigation position.
   */
  saveExamSession();
}


/* =========================================================
   RENDER OPTIONS
   ========================================================= */

function renderOptions(
  question
) {

  const container =
    getElement(
      "optionsContainer"
    );


  if (!container) {

    return;
  }


  container.innerHTML =
    "";


  let options =
    question.options ??
    question.choices ??
    [];


  if (
    !Array.isArray(
      options
    ) &&
    typeof options ===
      "object" &&
    options !== null
  ) {

    options =
      Object.entries(
        options
      ).map(
        function([
          letter,
          text
        ]) {

          return {
            letter:
              letter,

            text:
              text
          };
        }
      );
  }


  if (
    !Array.isArray(
      options
    )
  ) {

    options = [];
  }


  const questionId =
    getQuestionId(
      question
    );


  const questionType =
    String(
      question.type ??
      question.questionType ??
      "mc"
    ).toLowerCase();


  options.forEach(
    function(
      option,
      index
    ) {

      let letter;

      let text;


      if (
        typeof option ===
        "string"
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
        String(
          letter
        )
          .trim()
          .toUpperCase();


      const optionId =
        `question_${questionId}_${letter}`;


      const wrapper =
        document.createElement(
          "div"
        );


      wrapper.className =
        "option";


      const input =
        document.createElement(
          "input"
        );


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
        document.createElement(
          "span"
        );


      optionLetter.className =
        "option-letter";


      optionLetter.textContent =
        letter;


      const label =
        document.createElement(
          "label"
        );


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


      if (
        input.checked
      ) {

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

          saveExamSession();
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

function getQuestionId(
  question
) {

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
    getQuestionId(
      question
    );


  const questionType =
    String(
      question.type ??
      question.questionType ??
      "mc"
    ).toLowerCase();


  /*
   * Multiple choice / radio.
   */
  if (
    questionType !== "cb" &&
    questionType !== "checkbox" &&
    questionType !== "multiple"
  ) {

    if (checked) {

      answers[
        questionId
      ] =
        letter;

    } else if (
      answers[
        questionId
      ] === letter
    ) {

      delete answers[
        questionId
      ];
    }


    markAnswerDirty(questionId);
    saveExamSession();

    return;
  }


  /*
   * Checkbox / multiple answer.
   */
  let currentAnswers =
    answers[
      questionId
    ];


  if (
    !Array.isArray(
      currentAnswers
    )
  ) {

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


  if (
    currentAnswers.length
  ) {

    answers[
      questionId
    ] =
      currentAnswers;

  } else {

    delete answers[
      questionId
    ];
  }


  markAnswerDirty(questionId);
  saveExamSession();
}


function markAnswerDirty(questionId) {
  answerVersionCounter += 1;
  dirtyAnswerVersions[String(questionId)] = answerVersionCounter;
}


function clearSyncedAnswerVersions(snapshot) {
  Object.keys(snapshot).forEach(function(questionId) {
    if (dirtyAnswerVersions[questionId] === snapshot[questionId]) {
      delete dirtyAnswerVersions[questionId];
    }
  });
}


function buildDirtyAnswers() {
  const dirty = {};
  Object.keys(dirtyAnswerVersions).forEach(function(questionId) {
    if (Object.prototype.hasOwnProperty.call(answers, questionId)) {
      dirty[questionId] = answers[questionId];
    } else {
      /* Empty value tells the server to clear a previously saved answer. */
      dirty[questionId] = '';
    }
  });
  return dirty;
}


/* =========================================================
   CHECK ANSWER
   ========================================================= */

function hasAnswer(
  questionId,
  letter
) {

  const answer =
    answers[
      questionId
    ];


  if (
    Array.isArray(
      answer
    )
  ) {

    return answer.includes(
      String(
        letter
      ).toUpperCase()
    );
  }


  return String(
    answer ?? ""
  ).toUpperCase() ===
    String(
      letter
    ).toUpperCase();
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

function goToQuestion(
  index
) {

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
    getElement(
      "previousButton"
    );


  const nextButton =
    getElement(
      "nextButton"
    );


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

  if (
    !questions[
      currentQuestion
    ]
  ) {

    return;
  }


  const questionId =
    getQuestionId(
      questions[
        currentQuestion
      ]
    );


  reviewed[
    questionId
  ] =
    !reviewed[
      questionId
    ];


  updateReviewButton();

  renderQuestionNavigator();

  saveExamSession();
}


/* =========================================================
   UPDATE REVIEW BUTTON
   ========================================================= */

function updateReviewButton() {

  const button =
    getElement(
      "reviewButton"
    );


  if (!button) {

    return;
  }


  if (
    !questions[
      currentQuestion
    ]
  ) {

    button.textContent =
      "☆ Mark for Review";


    return;
  }


  const questionId =
    getQuestionId(
      questions[
        currentQuestion
      ]
    );


  if (
    reviewed[
      questionId
    ]
  ) {

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


  navigator.innerHTML =
    "";


  questions.forEach(
    function(
      question,
      index
    ) {

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
        answers[
          questionId
        ];


      const hasAnyAnswer =
        Array.isArray(
          answer
        )
          ? answer.length > 0
          : Boolean(answer);


      if (
        hasAnyAnswer
      ) {

        button.classList.add(
          "answered"
        );
      }


      if (
        reviewed[
          questionId
        ]
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

async function submitExam(
  automatic = false
) {

  if (
    examSubmitting ||
    !attemptId
  ) {

    return;
  }


  examSubmitting =
    true;


  closeConfirmModal();


  stopTimer();


  try {

    showLoading(
      automatic
        ? "Submitting your examination..."
        : "Submitting examination..."
    );


    await syncAnswersToServer(true);

    const formattedAnswers =
      formatAnswersForSubmission();


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


    examActive =
      false;


    examSubmitting =
      false;


    document.body.classList.remove(
      "exam-mode"
    );


    removeExamSecurityListeners();
    stopAnswerSync();
    stopInterruptionDetection();


    const completedAttemptId =
      attemptId;


    attemptId =
      null;


    clearExamSession(
      completedAttemptId
    );


    exitFullscreen();


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


    examSubmitting =
      false;


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

  const formatted =
    {};


  Object.keys(
    answers
  ).forEach(
    function(questionId) {

      const answer =
        answers[
          questionId
        ];


      if (
        Array.isArray(
          answer
        )
      ) {

        formatted[
          questionId
        ] =
          answer
            .map(
              value =>
                String(
                  value
                )
                  .trim()
                  .toUpperCase()
            )
            .filter(Boolean)
            .sort()
            .join(",");

      } else {

        formatted[
          questionId
        ] =
          String(
            answer
          )
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

      percentage =
        0;
    }
  }


  setText(
    "resultScore",
    `${score} / ${total}`
  );


  setText(
    "resultPercentage",
    `${Number(
      percentage
    ).toFixed(1)}%`
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

  if (examActive) {

    alert(
      "You cannot return to the dashboard while an examination is in progress."
    );


    return;
  }


  selectedBook =
    null;


  showScreen(
    "dashboardScreen"
  );


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


  currentStudent =
    null;


  books =
    [];


  selectedBook =
    null;


  questions =
    [];


  answers =
    {};


  reviewed =
    {};


  attemptId =
    null;


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

    studentId.value =
      "";
  }


  if (studentPin) {

    studentPin.value =
      "";
  }


  if (loginMessage) {

    loginMessage.textContent =
      "";
  }


  showScreen(
    "loginScreen"
  );
}


/* =========================================================
   RESTORE LOGIN SESSION
   ========================================================= */

async function restoreStudentSession() {

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


    currentStudent =
      student;


    setText(
      "studentName",
      getStudentName(
        currentStudent
      )
    );


    /*
     * Load books first.
     *
     * Then check for an active attempt.
     */
    await loadBooks();


    const resumed =
      await attemptExamRecovery();


    if (!resumed) {

      showScreen(
        "dashboardScreen"
      );
    }


  } catch (error) {

    console.error(
      "SESSION RESTORE ERROR:",
      error
    );


    /*
     * Do NOT automatically terminate an active attempt
     * merely because recovery encountered a temporary
     * network problem.
     *
     * Keep the login session so the student can retry.
     */
    try {

      showScreen(
        "dashboardScreen"
      );

    } catch (screenError) {

      console.error(
        screenError
      );
    }
  }
}


/* =========================================================
   EXAM SECURITY
   ========================================================= */

function setupExamSecurity() {

  removeExamSecurityListeners();


  document.addEventListener(
    "contextmenu",
    preventExamContextMenu
  );


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


  document.addEventListener(
    "keydown",
    preventExamKeyboard
  );


  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );


  window.addEventListener(
    "blur",
    handleWindowBlur
  );


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

function preventExamContextMenu(
  event
) {

  if (examActive) {

    event.preventDefault();
  }
}


/* =========================================================
   PREVENT COPY
   ========================================================= */

function preventExamCopy(
  event
) {

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

function preventExamSelection(
  event
) {

  if (examActive) {

    event.preventDefault();
  }
}


/* =========================================================
   PREVENT KEYBOARD SHORTCUTS
   ========================================================= */

function preventExamKeyboard(
  event
) {

  if (!examActive) {

    return;
  }


  const key =
    String(
      event.key || ""
    ).toLowerCase();


  if (
    (
      event.ctrlKey ||
      event.metaKey
    ) &&
    [
      "c",
      "x",
      "a",
      "u",
      "s",
      "p"
    ].includes(
      key
    )
  ) {

    event.preventDefault();


    showTemporarySecurityMessage(
      "This keyboard action is disabled during the examination."
    );


    return;
  }


  if (
    key === "f12" ||
    (
      event.ctrlKey &&
      event.shiftKey &&
      [
        "i",
        "j",
        "c"
      ].includes(
        key
      )
    )
  ) {

    event.preventDefault();


    showTemporarySecurityMessage(
      "This keyboard action is disabled during the examination."
    );


    return;
  }


  if (
    key === "printscreen"
  ) {

    event.preventDefault();


    window
      .getSelection()
      ?.removeAllRanges();


    showTemporarySecurityMessage(
      "Screen capture is restricted during the examination."
    );
  }
}


/* =========================================================
   VISIBILITY CHANGE
   ========================================================= */

function handleVisibilityChange() {

  if (!examActive || examSubmitting) return;

  if (document.visibilityState === "hidden") {
    if (interruptionDetectionTimer || interruptionInProgress) return;

    // Delay the violation decision slightly. A normal refresh/navigation fires
    // visibilitychange while the page is being unloaded and should not count.
    interruptionDetectionTimer = setTimeout(function() {
      interruptionDetectionTimer = null;
      if (!examActive || examSubmitting || document.visibilityState !== "hidden") return;

      interruptionInProgress = true;
      interruptionStartedAt = Date.now();
      saveExamSession();
      recordExamInterruption();
    }, 1000);

    return;
  }

  if (document.visibilityState === "visible") {
    if (interruptionDetectionTimer) {
      clearTimeout(interruptionDetectionTimer);
      interruptionDetectionTimer = null;
    }

    if (interruptionInProgress) {
      const hiddenFor = interruptionStartedAt ? Date.now() - interruptionStartedAt : 0;
      if (hiddenFor >= INTERRUPTION_GRACE_MS) {
        terminateExamForLeaving("The examination was terminated because the examination screen remained inactive for too long.", "LONG_INTERRUPTION");
      } else {
        resumeExamAfterInterruption();
      }
    }
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
   * We intentionally do not terminate on blur alone.
   *
   * visibilitychange remains the primary leave-page
   * detector.
   */
}


/* =========================================================
   BEFORE UNLOAD
   ========================================================= */

function handleBeforeUnload(
  event
) {

  if (
    !examActive ||
    examSubmitting
  ) {

    return;
  }


  event.preventDefault();

  event.returnValue =
    "";
}


async function recordExamInterruption() {
  if (!attemptId) return;
  try {
    await syncAnswersToServer(true);
    const result = await api("recordInterruption", {
      attemptId: attemptId,
      reason: "EXAMINATION_SCREEN_INACTIVE"
    });
    const count = Number(result?.interruptionCount || 0);
    if (result?.terminated || count >= 3) {
      await terminateExamForLeaving("The examination was terminated after repeated interruptions of the examination screen.", "TOO_MANY_INTERRUPTIONS");
      return;
    }
    const warning = count === 1
      ? "Warning: the examination screen became inactive. Returning to the examination will allow you to continue. Repeated interruptions may terminate the examination."
      : "Second warning: repeated interruptions have been detected. One more interruption may terminate this examination.";
    showTemporarySecurityMessage(warning);
  } catch (error) {
    // Network loss is deliberately not treated as a violation.
    console.warn("Unable to record interruption because the server is unreachable.", error);
  }
}

async function resumeExamAfterInterruption() {
  if (!attemptId) return;
  const hiddenFor = interruptionStartedAt ? Date.now() - interruptionStartedAt : 0;
  interruptionInProgress = false;
  interruptionStartedAt = null;

  if (hiddenFor >= INTERRUPTION_GRACE_MS) {
    await terminateExamForLeaving("The examination was terminated because the examination screen remained inactive for too long.", "LONG_INTERRUPTION");
    return;
  }

  try {
    const result = await api("recordResume", { attemptId: attemptId });
    if (result?.terminated) {
      await terminateExamForLeaving("The examination was terminated because the examination screen remained inactive for too long.", "LONG_INTERRUPTION");
      return;
    }
    showTemporarySecurityMessage("Examination resumed. Your previous answers are still saved.");
    startTimer();
  } catch (error) {
    // Do not terminate for a connection problem.
    console.warn("Unable to record examination resume.", error);
    showTemporarySecurityMessage("Connection restored locally. Your examination remains active; answers will synchronize when the server is reachable.");
    startTimer();
  }
}

async function syncAnswersToServer(force = false) {
  if (!attemptId || !examActive || answerSyncInFlight) return false;

  const now = Date.now();
  if (!force && now - lastAnswerSyncAt < ANSWER_SYNC_MIN_MS) return false;

  const dirty = buildDirtyAnswers();
  const dirtySnapshot = { ...dirtyAnswerVersions };

  /*
   * A forced sync sends the complete current answer state.
   * Routine sync sends only questions changed since the last
   * successful synchronization.
   */
  const payloadAnswers = force
    ? formatAnswersForSubmission()
    : dirty;

  if (!force && Object.keys(payloadAnswers).length === 0) {
    return false;
  }

  answerSyncInFlight = true;
  try {
    await api("saveAttemptAnswers", {
      attemptId: attemptId,
      answers: payloadAnswers
    });

    lastAnswerSyncAt = Date.now();

    if (force) {
      /* A force-sync represents the complete current state. */
      dirtyAnswerVersions = {};
    } else {
      clearSyncedAnswerVersions(dirtySnapshot);
    }

    return true;
  } catch (error) {
    console.warn(
      "Answer synchronization failed. Local answers remain available.",
      error
    );
    return false;
  } finally {
    answerSyncInFlight = false;
  }
}


function startAnswerSync() {
  stopAnswerSync();
  answerSyncInterval = setInterval(function() {
    if (
      examActive &&
      document.visibilityState === "visible"
    ) {
      syncAnswersToServer(false);
    }
  }, ANSWER_SYNC_INTERVAL_MS);
}

function stopInterruptionDetection() {
  if (interruptionDetectionTimer) {
    clearTimeout(interruptionDetectionTimer);
    interruptionDetectionTimer = null;
  }
}

function stopAnswerSync() {
  if (answerSyncInterval) {
    clearInterval(answerSyncInterval);
    answerSyncInterval = null;
  }
}


/* =========================================================
   TERMINATE EXAM FOR LEAVING
   ========================================================= */

async function terminateExamForLeaving(message, reason = "STUDENT_LEFT_EXAM") {
  if (!examActive || examSubmitting || examTerminated) return;

  examTerminated = true;
  examSubmitting = true;
  stopTimer();
  const terminatedAttemptId = attemptId;
  const formattedAnswers = formatAnswersForSubmission();

  try {
    await syncAnswersToServer(true);
    const result = await api("terminateAttempt", {
      attemptId: terminatedAttemptId,
      reason: reason,
      answers: formattedAnswers
    });

    examActive = false;
    document.body.classList.remove("exam-mode");
    removeExamSecurityListeners();
    stopInterruptionDetection();
    stopAnswerSync();
    exitFullscreen();
    clearExamSession(terminatedAttemptId);
    attemptId = null;

    if (result && (result.score !== undefined || result.totalMarks !== undefined)) {
      displayResult(result);
      showScreen("resultScreen");
    } else {
      showExamTerminationScreen(message);
    }
  } catch (error) {
    console.error("TERMINATE ATTEMPT ERROR:", error);
    // Network failure is NOT a cheating violation. Keep the local session so recovery can continue.
    examTerminated = false;
    examSubmitting = false;
    if (reason === "LONG_INTERRUPTION") {
      showTemporarySecurityMessage("The connection to the examination server was lost. Your examination has not been terminated. Please reconnect and return to the examination.");
    }
    return;
  } finally {
    if (!examActive) examSubmitting = false;
  }
}

/* =========================================================
   EXAM TERMINATION SCREEN
   ========================================================= */

function showExamTerminationScreen(
  message
) {

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

let securityMessageTimeout =
  null;


function showTemporarySecurityMessage(
  message
) {

  let element =
    getElement(
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

function escapeHtml(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";
  }


  return String(
    value
  )
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

    showScreen(
      "loginScreen"
    );


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


    restoreStudentSession();

  }
);