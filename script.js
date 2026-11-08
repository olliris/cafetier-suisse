let quiz = [];

// Load quiz questions from questions.json
fetch("questions.json")
  .then(response => response.json())
  .then(data => {
    quiz = data;
  })
  .catch(error => {
    console.error("Error loading quiz questions:", error);
  });

let currentQuestion = 0;
let score = 0;
let mode = '';
let timerInterval;
let timeLeft;
let numQuestions = 90;
let shuffledQuiz = [];
let examHistory = JSON.parse(localStorage.getItem('examHistory')) || [];
let markedQuestions = JSON.parse(localStorage.getItem('markedQuestions')) || [];
let exerciseResults = JSON.parse(localStorage.getItem('exerciseResults')) || {};
let currentRangeKey = ''; // Pour suivre la plage actuelle

function chooseExamRange() {
  window.scrollTo(0,0);
  hideAll();
  document.getElementById("examRangePage").classList.remove("hidden");
}

function startExam() {
  window.scrollTo(0,0);
  mode = 'exam';
  timeLeft = 120 * 60;
  
  // Limiter aux questions 1-210 uniquement
  const rangeQuestions = quiz.slice(0, 210);
  numQuestions = Math.min(75, rangeQuestions.length);
  
  // Mélanger les questions de manière aléatoire dans la plage 1-210
  shuffledQuiz = [...rangeQuestions].sort(() => Math.random() - 0.5).slice(0, numQuestions);
  
  hideAll();
  document.getElementById("game").classList.remove("hidden");
  document.getElementById("timer").classList.remove("hidden");
  document.getElementById("score").classList.remove("hidden");
  currentQuestion = 0;
  score = 0;
  showQuestions();
  startTimer();
}

function startExamRange(start, end) {
  window.scrollTo(0,0);
  mode = 'exam';
  timeLeft = 120 * 60;
  
  // Limiter aux questions de la plage sélectionnée
  const rangeQuestions = quiz.slice(start - 1, end);
  numQuestions = Math.min(75, rangeQuestions.length);
  
  // Mélanger les questions de manière aléatoire
  shuffledQuiz = [...rangeQuestions].sort(() => Math.random() - 0.5).slice(0, numQuestions);
  
  hideAll();
  document.getElementById("game").classList.remove("hidden");
  document.getElementById("timer").classList.remove("hidden");
  document.getElementById("score").classList.remove("hidden");
  currentQuestion = 0;
  score = 0;
  showQuestions();
  startTimer();
}

function chooseExerciseRange() {
  window.scrollTo(0,0);
  hideAll();
  document.getElementById("exerciseRangePage").classList.remove("hidden");

  var markedRow = document.getElementById("exerciseMarkedRow");
  var markedCount = markedQuestions.length;
  markedRow.innerHTML = "";
  var markedBtn = document.createElement("button");
  markedBtn.className = "exercise-marked-btn";
  var flagSpan = document.createElement("span");
  flagSpan.textContent = "⚑";
  flagSpan.style.marginRight = "6px";
  flagSpan.style.color = markedCount > 0 ? "red" : "#555";
  markedBtn.appendChild(flagSpan);
  markedBtn.appendChild(document.createTextNode("Questions Marquées"));
  if (markedCount > 0) {
    var countSpan = document.createElement("span");
    countSpan.className = "marked-count";
    countSpan.textContent = " (" + markedCount + ")";
    markedBtn.appendChild(countSpan);
  }
  markedBtn.onclick = function() { showMarkedQuestions(); };
  markedRow.appendChild(markedBtn);
  var sep = document.createElement("p");
  sep.className = "exercise-section-label";
  sep.textContent = "Choisissez une plage de questions :";
  markedRow.appendChild(sep);

  var exerciseRangeOptions = document.getElementById("exerciseRangeOptions");
  exerciseRangeOptions.innerHTML = '';
  for (var i = 0; i < quiz.length; i += 30) {
    var start = i + 1;
    var end = Math.min(i + 30, quiz.length);
    var rangeKey = start + "-" + end;
    var rangeButton = document.createElement("button");
    rangeButton.className = "exercise-range-btn";
    var percentage = exerciseResults[rangeKey];
    if (percentage !== undefined) {
      rangeButton.textContent = start + " à " + end + "  —  " + percentage + "%";
    } else {
      rangeButton.textContent = start + " à " + end;
    }
    rangeButton.onclick = (function(s, e) {
      return function() { startExerciseRange(s - 1, e); };
    })(start, end);
    exerciseRangeOptions.appendChild(rangeButton);
  }
}

function startExerciseRange(start, end) {
  mode = 'exercise';
  numQuestions = end - start;
  shuffledQuiz = quiz.slice(start, end);
  shuffledQuiz.sort(() => Math.random() - 0.5);
  
  // Enregistrer la plage actuelle
  currentRangeKey = `${start + 1}-${end}`;
  
  hideAll();
  document.getElementById("game").classList.remove("hidden");
  currentQuestion = 0;
  score = 0;
  document.getElementById("timer").classList.add("hidden");
  document.getElementById("score").classList.add("hidden");
  document.getElementById("feedback").classList.add("hidden");
  showQuestion();
}

function showMarkedQuestions() {
  shuffledQuiz = markedQuestions;
  mode = 'flagged';
  currentQuestion = 0;
  numQuestions = markedQuestions.length;
  hideAll();
  document.getElementById("game").classList.remove("hidden");
  showQuestion();
}

function markQuestion(question) {
  const index = markedQuestions.findIndex(q => q.question === question.question);
  if (index === -1) {
    markedQuestions.push(question);
  } else {
    markedQuestions.splice(index, 1);
  }
  localStorage.setItem('markedQuestions', JSON.stringify(markedQuestions));
  const flagButton = document.querySelector(`.flag-button[data-question="${question.question}"]`);
  if (flagButton) {
    const isMarked = markedQuestions.some(markedQ => markedQ.question === question.question);
    flagButton.classList.toggle("red", isMarked);
    flagButton.textContent = "⚑";
  }
}

function showQuestions() {
  const questionsDiv = document.getElementById("questions");
  questionsDiv.innerHTML = "";
  const quizToShow = shuffledQuiz;
  quizToShow.forEach((q, index) => {
    const questionDiv = document.createElement("div");
    questionDiv.classList.add("question");

    const flagAndQuestion = document.createElement("div");
    flagAndQuestion.classList.add("flag-and-question");

    const flagButton = document.createElement("button");
    flagButton.classList.add("flag-button");
    flagButton.setAttribute("data-question", q.question);
    const isMarked = markedQuestions.some(markedQ => markedQ.question === q.question);
    flagButton.classList.toggle("red", isMarked);
    flagButton.textContent = "⚑";
    flagButton.onclick = () => markQuestion(q);
    flagAndQuestion.appendChild(flagButton);

    const questionText = document.createElement("p");
    questionText.innerHTML = q.question.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
    flagAndQuestion.appendChild(questionText);
    questionDiv.appendChild(flagAndQuestion);

    const answersDiv = document.createElement("div");
    answersDiv.classList.add("answers");
    q.answers.forEach((ans, ansIndex) => {
      const answerButton = document.createElement("button");
      answerButton.textContent = ans;
      answerButton.classList.add("answer-button");
      answerButton.onclick = () => selectAnswer(index, ansIndex, answerButton);
      answersDiv.appendChild(answerButton);
    });
    questionDiv.appendChild(answersDiv);

    if (mode === 'exam') {
      document.getElementById("endButton").classList.remove("hidden");
    }
    questionsDiv.appendChild(questionDiv);
  });
  document.getElementById("feedback").textContent = "";
  document.getElementById("score").textContent = `Score: ${score}/${numQuestions}`;
}

function showQuestion() {
  const questionsDiv = document.getElementById("questions");
  questionsDiv.innerHTML = "";

  // If no questions are available (for flagged mode)
  if (!shuffledQuiz.length) {
    questionsDiv.innerHTML = "<p>Aucune question disponible.</p>";

    const homeButton = document.createElement("button");
    homeButton.textContent = "Retour à l'accueil";
    homeButton.onclick = () => {
      goBackToHome();
      homeButton.remove();
    };
    questionsDiv.appendChild(homeButton);
    return;
  }

  if (currentQuestion >= numQuestions) {
    showFinalScore();
    return;
  }

  const q = shuffledQuiz[currentQuestion];
  const questionDiv = document.createElement("div");
  questionDiv.classList.add("question");

  const flagAndQuestion = document.createElement("div");
  flagAndQuestion.classList.add("flag-and-question");

  const flagButton = document.createElement("button");
  flagButton.classList.add("flag-button");
  flagButton.setAttribute("data-question", q.question);
  const isMarked = markedQuestions.some(markedQ => markedQ.question === q.question);
  flagButton.classList.toggle("red", isMarked);
  flagButton.textContent = "⚑";
  flagButton.onclick = () => markQuestion(q);
  flagAndQuestion.appendChild(flagButton);

  const questionText = document.createElement("p");
  questionText.innerHTML = q.question.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  flagAndQuestion.appendChild(questionText);
  questionDiv.appendChild(flagAndQuestion);

  const answersDiv = document.createElement("div");
  answersDiv.classList.add("answers");
  q.answers.forEach((ans, ansIndex) => {
    const answerButton = document.createElement("button");
    answerButton.textContent = ans;
    answerButton.classList.add("answer-button");
    answerButton.onclick = () => selectAnswer(currentQuestion, ansIndex, answerButton);
    answersDiv.appendChild(answerButton);
  });
  questionDiv.appendChild(answersDiv);

  if (mode === 'exercise' || mode === 'flagged') {
    const submitButton = document.createElement("button");
    submitButton.textContent = "Soumettre";

    const nextButton = document.createElement("button");
    nextButton.textContent = "Suivant";
    nextButton.style.display = "none";
    nextButton.onclick = nextQuestion;

    const endButton = document.createElement("button");
    endButton.textContent = "Terminer";
    endButton.onclick = resetQuiz;

    submitButton.onclick = function() {
      checkAnswer(currentQuestion);
      submitButton.style.display = "none";
      nextButton.style.display = "inline-block";
    };

    questionDiv.appendChild(submitButton);
    questionDiv.appendChild(nextButton);
    questionDiv.appendChild(endButton);
  }
  questionsDiv.appendChild(questionDiv);
}

function selectAnswer(questionIndex, answerIndex, button) {
  const q = shuffledQuiz[questionIndex];
  button.classList.toggle("selected");
}

function nextQuestion() {
  currentQuestion++;
  showQuestion();
}

function checkAnswer(questionIndex) {
  const q = shuffledQuiz[questionIndex];
  const questionDiv = document.querySelector("#questions .question:nth-child(1)");
  const buttons = questionDiv.querySelectorAll(".answer-button");
  let candidateSelected = [];
  buttons.forEach((button, index) => {
    if (button.classList.contains("selected")) {
      candidateSelected.push(index);
    }
  });
  buttons.forEach((button, index) => {
    if (q.correct.includes(index)) {
      button.classList.add("correct");
      if (button.classList.contains("selected")) {
        if (!button.querySelector(".check-mark")) {
          button.insertAdjacentHTML("afterbegin", "<span class='check-mark'>✓ </span>");
        }
        button.classList.remove("selected");
      }
    } else if (button.classList.contains("selected")) {
      button.classList.add("incorrect");
      button.classList.remove("selected");
    }
  });
  const missingCorrect = q.correct.filter(correctIndex => !candidateSelected.includes(correctIndex));
  if (q.correct.length > 1 && missingCorrect.length > 0) {
    const messageElem = document.createElement("p");
    messageElem.className = "missing-message";
    messageElem.textContent = "Attention il y a plusieurs bonnes réponses";
    questionDiv.appendChild(messageElem);
  }
  const correctSelected = candidateSelected.filter(ans => q.correct.includes(ans)).length;
  const incorrectSelected = candidateSelected.length - correctSelected;
  if (correctSelected === q.correct.length && incorrectSelected === 0) {
    score++;
  }
  document.getElementById("score").textContent = `Score: ${score}/${numQuestions}`;
}

function endExam() {
  clearInterval(timerInterval);
  const questionsDiv = document.getElementById("questions");
  const questionDivs = questionsDiv.querySelectorAll(".question");
  
  // Réinitialiser le score avant de recalculer
  score = 0;
  
  questionDivs.forEach((questionDiv, index) => {
    const q = shuffledQuiz[index]; // CORRECTION: utiliser shuffledQuiz au lieu de quiz
    const buttons = questionDiv.querySelectorAll(".answer-button");
    let candidateSelected = [];
    buttons.forEach((button, btnIndex) => {
      if (button.classList.contains("selected")) {
        candidateSelected.push(btnIndex);
      }
    });
    
    buttons.forEach((button, btnIndex) => {
      if (q.correct.includes(btnIndex)) {
        button.classList.add("correct");
        if (button.classList.contains("selected")) {
          if (!button.querySelector(".check-mark")) {
            button.insertAdjacentHTML("afterbegin", "<span class='check-mark'>✓ </span>");
          }
          button.classList.remove("selected");
        }
      } else if (button.classList.contains("selected")) {
        button.classList.add("incorrect");
        button.classList.remove("selected");
      }
    });
    
    const missingCorrect = q.correct.filter(idx => !candidateSelected.includes(idx));
    if (q.correct.length > 1 && missingCorrect.length > 0) {
      const messageElem = document.createElement("p");
      messageElem.className = "missing-message";
      messageElem.textContent = "Attention il y a plusieurs bonnes réponses";
      questionDiv.appendChild(messageElem);
    }
    
    // Calculer le score
    const correctSelected = candidateSelected.filter(ans => q.correct.includes(ans)).length;
    const incorrectSelected = candidateSelected.length - correctSelected;
    const isCorrect = (correctSelected === q.correct.length && incorrectSelected === 0);
    
    if (isCorrect) {
      score++;
    } else {
      // CORRECTION: Ajouter aux questions marquées SEULEMENT si la réponse est incorrecte
      if (mode === 'exam' && !markedQuestions.some(markedQ => markedQ.question === q.question)) {
        markedQuestions.push(q);
      }
    }
  });
  localStorage.setItem('markedQuestions', JSON.stringify(markedQuestions));
  const percentage = (score / numQuestions) * 100;
  let feedbackMessage = '';
  if (percentage < 85) {
    feedbackMessage = "Retourne au fourgon ket";
    document.getElementById("feedback").classList.add("red");
    document.getElementById("feedback").classList.remove("green");
  } else {
    feedbackMessage = "Bravo champion tu es prêt!";
    document.getElementById("feedback").classList.add("green");
    document.getElementById("feedback").classList.remove("red");
  }
  document.getElementById("feedback").textContent = feedbackMessage;
  document.getElementById("feedback").classList.remove("hidden");
  document.getElementById("score").textContent = `Score final : ${score}/${numQuestions} (${percentage.toFixed(2)}%)`;
  examHistory.push(percentage);
  localStorage.setItem('examHistory', JSON.stringify(examHistory));
  displayHistory();
  document.getElementById("endButton").classList.add("hidden");
  if (!document.getElementById("game").querySelector("button#backButton")) {
    const backButton = document.createElement("button");
    backButton.textContent = "Retourner à l'accueil";
    backButton.id = "backButton";
    backButton.onclick = resetQuiz;
    document.getElementById("game").appendChild(backButton);
  }
}

function showFinalScore() {
  const percentage = (score / numQuestions) * 100;
  alert(`Vous avez terminé l'exercice avec un score de ${percentage.toFixed(2)}%`);
  
  // Sauvegarder le résultat pour la plage de questions
  if (mode === 'exercise' && currentRangeKey) {
    exerciseResults[currentRangeKey] = percentage.toFixed(2);
    localStorage.setItem('exerciseResults', JSON.stringify(exerciseResults));
  }
  
  goBackToHome();
}

function resetQuiz() {
  currentQuestion = 0;
  score = 0;
  mode = '';
  numQuestions = 50;
  shuffledQuiz = [];
  currentRangeKey = '';
  document.getElementById("game").classList.add("hidden");
  document.querySelector(".quiz-container").classList.remove("hidden");
  document.getElementById("footer").style.display = "block";
  document.getElementById("timer").classList.add("hidden");
  document.getElementById("score").classList.add("hidden");
  document.getElementById("feedback").classList.add("hidden");
  const backButton = document.getElementById("game").querySelector("button#backButton");
  if (backButton) {
    backButton.remove();
  }
}

function showHistory() {
  window.scrollTo(0,0);
  hideAll();
  document.getElementById("historyPage").classList.remove("hidden");
  displayHistory();
}

function displayHistory() {
  const historyContent = document.getElementById("historyContent");
  historyContent.innerHTML = "";
  if (examHistory.length === 0) {
    historyContent.textContent = "Aucun examen effectué.";
    return;
  }
  const historyList = document.createElement("ul");
  examHistory.forEach((score, index) => {
    const listItem = document.createElement("li");
    listItem.textContent = `Examen ${index + 1}: ${score.toFixed(2)}%`;
    historyList.appendChild(listItem);
  });
  historyContent.appendChild(historyList);
}

function goBackToHome() {
  window.scrollTo(0,0);
  var ids = ["game","exerciseRangePage","historyPage","flashcardsPage","flashcardDeckPage","schemasPage","schemasCategoryPage","schemaDetailPage"];
  ids.forEach(function(id) { document.getElementById(id).classList.add("hidden"); });
  document.querySelector(".quiz-container").classList.remove("hidden");
  document.getElementById("footer").style.display = "block";
}

function hideAll() {
  var ids = ["game","exerciseRangePage","historyPage","flashcardsPage","flashcardDeckPage","schemasPage","schemasCategoryPage","schemaDetailPage"];
  ids.forEach(function(id) { document.getElementById(id).classList.add("hidden"); });
  document.querySelector(".quiz-container").classList.add("hidden");
  document.getElementById("footer").style.display = "none";
}

function startTimer() {
  timerInterval = setInterval(function() {
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endExam();
      return;
    }
    timeLeft--;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById("timer").textContent = `Temps restant : ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }, 1000);
}

function resetCache() {
  localStorage.removeItem('examHistory');
  localStorage.removeItem('markedQuestions');
  localStorage.removeItem('exerciseResults');
  localStorage.removeItem('markedFlashcards');
  localStorage.removeItem('markedSchemas');
  examHistory = [];
  markedQuestions = [];
  exerciseResults = {};
  if (typeof markedFlashcards !== 'undefined') markedFlashcards = [];
  if (typeof markedSchemas !== 'undefined') markedSchemas = [];
  alert("Le cache a été réinitialisé.");
  displayHistory();
  if (!document.getElementById("exerciseRangePage").classList.contains("hidden")) {
    chooseExerciseRange();
  }
}// --- SCHEMAS ---

var schemasData = null;
var schemasLoaded = false;
var currentSchemaCategory = "";
var markedSchemas = JSON.parse(localStorage.getItem("markedSchemas")) || [];

var schemaCategories = [
  "Physiologie et Chimie","La Cellule","Les Tissus",
  "Système Cardio-vasculaire","Système Lymphatique","Système Respiratoire",
  "Système Nerveux","Système Endocrinien","Système Digestif",
  "Système Urinaire","Système Reproducteur","Système Locomoteur",
  "Les Sens","Traumatologie","Questionnaire d'entraînement"
];

function isSchemaMarked(name) { return markedSchemas.indexOf(name) !== -1; }

function toggleSchemaMarked(name) {
  var idx = markedSchemas.indexOf(name);
  if (idx === -1) { markedSchemas.push(name); } else { markedSchemas.splice(idx, 1); }
  localStorage.setItem("markedSchemas", JSON.stringify(markedSchemas));
}

function showSchemas() {
  window.scrollTo(0,0);
  hideAll();
  document.getElementById("schemasPage").classList.remove("hidden");
  if (!schemasLoaded) {
    fetch("schemas.json")
      .then(function(r) { return r.json(); })
      .then(function(data) { schemasData = data; schemasLoaded = true; renderSchemasFolders(); })
      .catch(function(e) { console.error("Erreur schemas.json:", e); schemasData = []; renderSchemasFolders(); });
  } else { renderSchemasFolders(); }
}

function renderSchemasFolders() {
  var container = document.getElementById("schemasFolders");
  container.innerHTML = "";
  schemaCategories.forEach(function(cat) {
    var schemas = schemasData ? schemasData.filter(function(s) { return s.category === cat; }) : [];
    var count = schemas.length;
    var btn = document.createElement("button");
    btn.className = "fc-folder-btn";
    btn.textContent = "📁 " + cat + (count > 0 ? " (" + count + ")" : "");
    btn.setAttribute("data-cat", cat);
    btn.addEventListener("click", function() { openSchemaCategory(this.getAttribute("data-cat")); });
    container.appendChild(btn);
  });
}

function openSchemaCategory(cat) {
  window.scrollTo(0,0);
  currentSchemaCategory = cat;
  document.getElementById("schemasPage").classList.add("hidden");
  document.getElementById("schemasCategoryPage").classList.remove("hidden");
  document.getElementById("schemasCategoryTitle").textContent = cat;
  renderSchemasGrid();
}

function backToSchemasCategories() {
  window.scrollTo(0,0);
  document.getElementById("schemasCategoryPage").classList.add("hidden");
  document.getElementById("schemasPage").classList.remove("hidden");
  renderSchemasFolders();
}

function renderSchemasGrid() {
  var grid = document.getElementById("schemasGrid");
  grid.innerHTML = "";
  var schemas = schemasData ? schemasData.filter(function(s) { return s.category === currentSchemaCategory; }) : [];
  if (schemas.length === 0) {
    grid.innerHTML = "<p class='missing-message'>Aucun schéma disponible pour cette catégorie pour le moment.</p>";
    return;
  }
  schemas.forEach(function(schema) {
    var globalIndex = schemasData.indexOf(schema);
    var card = document.createElement("div");
    card.className = "schema-card";
    card.setAttribute("data-index", globalIndex);
    var img = document.createElement("img");
    img.src = schema.image;
    img.alt = schema.name;
    img.className = "schema-thumb";
    var labelRow = document.createElement("div");
    labelRow.className = "schema-label-row";
    var cardFlag = document.createElement("button");
    cardFlag.className = "flag-button schema-card-flag" + (isSchemaMarked(schema.name) ? " red" : "");
    cardFlag.textContent = "⚑";
    cardFlag.title = "Marquer";
    cardFlag.addEventListener("click", function(e) {
      e.stopPropagation();
      toggleSchemaMarked(schema.name);
      this.className = "flag-button schema-card-flag" + (isSchemaMarked(schema.name) ? " red" : "");
    });
    var label = document.createElement("span");
    label.className = "schema-label";
    label.textContent = schema.name;
    labelRow.appendChild(cardFlag);
    labelRow.appendChild(label);
    card.appendChild(img);
    card.appendChild(labelRow);
    card.addEventListener("click", function() { openSchema(parseInt(this.getAttribute("data-index"))); });
    grid.appendChild(card);
  });
}

function backToSchemasGrid() {
  window.scrollTo(0,0);
  document.getElementById("schemaDetailPage").classList.add("hidden");
  document.getElementById("schemasCategoryPage").classList.remove("hidden");
  renderSchemasGrid();
}

function openSchema(index) {
  var schema = schemasData[index];
  document.getElementById("schemasCategoryPage").classList.add("hidden");
  document.getElementById("schemaDetailPage").classList.remove("hidden");
  var content = document.getElementById("schemaDetailContent");
  var allAnswers = schema.elements.map(function(e) { return e.answer; });
  var uniqueAnswers = allAnswers.filter(function(v, i, a) { return a.indexOf(v) === i; });
  uniqueAnswers.sort();
  window.scrollTo(0, 0);
  var marked = isSchemaMarked(schema.name);
  var safeName = schema.name.replace(/"/g, "&quot;");
  var html = "<div class='schema-title-row'>";
  html += "<button class='flag-button schema-detail-flag" + (marked ? " red" : "") + "' ";
  html += "onclick='toggleSchemaMarked(\"" + safeName + "\");";
  html += "this.className=\"flag-button schema-detail-flag\"+(isSchemaMarked(\"" + safeName + "\")?\" red\":\"\");'>⚑</button>";
  html += "<h2 style='display:inline;margin-left:8px'>" + schema.name + "</h2></div>";
  html += "<img src='" + schema.image + "' class='schema-full-img' alt='" + schema.name + "'>";
  html += "<div class='schema-elements'>";
  html += "<p class='schema-instructions'>Associez chaque numéro au bon élément :</p>";
  schema.elements.forEach(function(el) {
    html += "<div class='schema-row'>";
    html += "<span class='schema-number'>" + el.number + "</span>";
    html += "<select class='schema-select' data-answer='" + el.answer.replace(/'/g,"&#39;") + "'>";
    html += "<option value=''>— Choisir —</option>";
    uniqueAnswers.forEach(function(ans) {
      html += "<option value='" + ans.replace(/'/g,"&#39;") + "'>" + ans + "</option>";
    });
    html += "</select><span class='schema-result'></span></div>";
  });
  html += "</div>";
  html += "<button onclick='checkSchema()' style='margin-top:15px'>✔ Vérifier</button>";
  html += "<button onclick='resetSchema()' style='margin-top:15px'>↺ Recommencer</button>";
  html += "<p id='schemaScore' class='schema-score'></p>";
  content.innerHTML = html;
}

function checkSchema() {
  var rows = document.querySelectorAll(".schema-row");
  var correct = 0;
  var total = rows.length;
  rows.forEach(function(row) {
    var select = row.querySelector(".schema-select");
    var result = row.querySelector(".schema-result");
    var expected = select.getAttribute("data-answer");
    var chosen = select.value;
    if (chosen === "") {
      result.textContent = " \u2717 \u2192 " + expected;
      result.className = "schema-result schema-incorrect";
      select.style.borderColor = "red";
    } else if (chosen === expected) {
      result.textContent = " ✓"; result.className = "schema-result schema-correct";
      select.style.borderColor = "green"; correct++;
    } else {
      result.textContent = " ✗ → " + expected;
      result.className = "schema-result schema-incorrect";
      select.style.borderColor = "red";
    }
  });
  var pct = Math.round((correct / total) * 100);
  var scoreEl = document.getElementById("schemaScore");
  scoreEl.textContent = "Score : " + correct + " / " + total + " (" + pct + "%)";
  scoreEl.className = "schema-score " + (pct >= 80 ? "schema-score-good" : "schema-score-bad");
}

function resetSchema() {
  document.querySelectorAll(".schema-select").forEach(function(s) { s.value = ""; s.style.borderColor = ""; });
  document.querySelectorAll(".schema-result").forEach(function(r) { r.textContent = ""; r.className = "schema-result"; });
  document.getElementById("schemaScore").textContent = "";
}

// --- FLASHCARDS ---

var flashcardsData = null;
var markedFlashcards = JSON.parse(localStorage.getItem('markedFlashcards')) || [];
var currentDeckCards = [];
var currentCardIndex = 0;

var flashcardDecks = [
  "Physiologie et Chimie","La Cellule","Les Tissus",
  "Système Cardio-vasculaire","Système Lymphatique","Système Respiratoire",
  "Système Nerveux","Système Endocrinien","Système Digestif",
  "Système Urinaire","Système Reproducteur","Système Locomoteur",
  "Les Sens","Traumatologie","Questionnaire d'entraînement"
];

function showFlashcards() {
  window.scrollTo(0,0);
  hideAll();
  document.getElementById("flashcardsPage").classList.remove("hidden");
  if (flashcardsData === null) {
    fetch("flashcards.json")
      .then(function(r) { return r.json(); })
      .then(function(data) { flashcardsData = data; renderFlashcardFolders(); })
      .catch(function() { flashcardsData = {}; renderFlashcardFolders(); });
  } else { renderFlashcardFolders(); }
}

function renderFlashcardFolders() {
  var container = document.getElementById("flashcardsFolders");
  container.innerHTML = "";
  var markedCount = markedFlashcards.length;
  var markedBtn = document.createElement("button");
  markedBtn.className = "exercise-marked-btn";
  var flagSpan = document.createElement("span");
  flagSpan.textContent = "⚑";
  flagSpan.style.marginRight = "6px";
  flagSpan.style.color = markedCount > 0 ? "red" : "#555";
  markedBtn.appendChild(flagSpan);
  markedBtn.appendChild(document.createTextNode("Flashcards Marquées"));
  if (markedCount > 0) {
    var countSpan = document.createElement("span");
    countSpan.className = "marked-count";
    countSpan.textContent = " (" + markedCount + ")";
    markedBtn.appendChild(countSpan);
  }
  markedBtn.onclick = function() { openMarkedFlashcards(); };
  container.appendChild(markedBtn);
  var sep = document.createElement("p");
  sep.className = "exercise-section-label";
  sep.textContent = "Choisissez un dossier :";
  container.appendChild(sep);
  for (var i = 0; i < flashcardDecks.length; i++) {
    var deckName = flashcardDecks[i];
    var cards = flashcardsData[deckName];
    var count = (cards && cards.length) ? cards.length : 0;
    var btn = document.createElement("button");
    btn.className = "fc-folder-btn";
    btn.textContent = "📁 " + deckName + (count > 0 ? " (" + count + ")" : "");
    btn.setAttribute("data-deck", deckName);
    btn.addEventListener("click", function() { openFlashcardDeck(this.getAttribute("data-deck")); });
    container.appendChild(btn);
  }
}

function openMarkedFlashcards() {
  window.scrollTo(0,0);
  document.getElementById("flashcardsPage").classList.add("hidden");
  document.getElementById("flashcardDeckPage").classList.remove("hidden");
  currentDeckCards = markedFlashcards;
  currentCardIndex = 0;
  var content = document.getElementById("flashcardDeckContent");
  if (markedFlashcards.length === 0) {
    content.innerHTML = "<h2>Flashcards Marquées</h2><p class='missing-message'>Aucune flashcard marquée pour le moment.</p>";
    return;
  }
  renderDeckPage("Flashcards Marquées");
}

function backToFlashcards() {
  window.scrollTo(0,0);
  document.getElementById("flashcardDeckPage").classList.add("hidden");
  document.getElementById("flashcardsPage").classList.remove("hidden");
  renderFlashcardFolders();
}

function openFlashcardDeck(deckName) {
  window.scrollTo(0,0);
  document.getElementById("flashcardsPage").classList.add("hidden");
  document.getElementById("flashcardDeckPage").classList.remove("hidden");
  var cards = (flashcardsData && flashcardsData[deckName]) ? flashcardsData[deckName] : [];
  currentDeckCards = cards;
  currentCardIndex = 0;
  var content = document.getElementById("flashcardDeckContent");
  if (cards.length === 0) {
    content.innerHTML = "<h2>" + deckName + "</h2><p class='missing-message'>Aucune flashcard disponible pour ce dossier pour le moment.</p>";
    return;
  }
  renderDeckPage(deckName);
}

function renderDeckPage(title) {
  var content = document.getElementById("flashcardDeckContent");
  content.innerHTML =
    "<h2>" + title + "</h2>" +
    "<div class='fc-mode-btns'>" +
      "<button class='fc-mode-btn active' id='btnSequential' onclick='switchDeckMode(\"sequential\")'>\u25b6 S\u00e9quentiel</button>" +
      "<button class='fc-mode-btn' id='btnSummary' onclick='switchDeckMode(\"summary\")'>\u2261 R\u00e9sum\u00e9</button>" +
    "</div>" +
    "<div id='flashcardArea'></div>" +
    "<div id='flashcardNav'></div>";
  renderCard();
}

function switchDeckMode(mode) {
  document.getElementById("btnSequential").className = "fc-mode-btn" + (mode === "sequential" ? " active" : "");
  document.getElementById("btnSummary").className = "fc-mode-btn" + (mode === "summary" ? " active" : "");
  if (mode === "sequential") {
    document.getElementById("flashcardNav").style.display = "";
    renderCard();
  } else {
    renderFlashcardSummary();
  }
}

function renderFlashcardSummary() {
  window.scrollTo(0,0);
  var area = document.getElementById("flashcardArea");
  var nav = document.getElementById("flashcardNav");
  nav.style.display = "none";
  area.innerHTML = "";
  var list = document.createElement("div");
  list.className = "fc-summary-list";
  currentDeckCards.forEach(function(card, idx) {
    var item = document.createElement("div");
    item.className = "fc-summary-item" + (isFlashcardMarked(card) ? " fc-summary-marked" : "");
    item.setAttribute("data-idx", idx);

    var num = document.createElement("span");
    num.className = "fc-summary-num";
    num.textContent = (idx + 1) + ".";

    var link = document.createElement("span");
    link.className = "fc-summary-link";
    link.textContent = card.front;

    item.appendChild(num);
    item.appendChild(link);
    item.addEventListener("click", function() {
      openCardFromSummary(parseInt(this.getAttribute("data-idx")));
    });
    list.appendChild(item);
  });
  area.appendChild(list);
}

function openCardFromSummary(idx) {
  window.scrollTo(0,0);
  currentCardIndex = idx;
  document.getElementById("btnSequential").className = "fc-mode-btn active";
  document.getElementById("btnSummary").className = "fc-mode-btn";
  document.getElementById("flashcardNav").style.display = "";
  renderCard();
}

function markFlashcard(card) {
  var idx = markedFlashcards.findIndex(function(c) { return c.front === card.front; });
  if (idx === -1) { markedFlashcards.push(card); } else { markedFlashcards.splice(idx, 1); }
  localStorage.setItem('markedFlashcards', JSON.stringify(markedFlashcards));
}

function isFlashcardMarked(card) {
  return markedFlashcards.some(function(c) { return c.front === card.front; });
}

function renderCard() {
  var area = document.getElementById("flashcardArea");
  var nav  = document.getElementById("flashcardNav");
  var card = currentDeckCards[currentCardIndex];
  var cardDiv = document.createElement("div");
  cardDiv.className = "fc-card";
  cardDiv.id = "fcCard";
  var front = document.createElement("div");
  front.className = "fc-front";
  front.innerHTML = card.front.replace(/\n/g, '<br>');
  var back = document.createElement("div");
  back.className = "fc-back hidden";
  back.innerHTML = card.back.replace(/\n/g, '<br>');
  cardDiv.appendChild(front);
  cardDiv.appendChild(back);
  cardDiv.addEventListener("click", function() { flipCard(); });
  var counter = document.createElement("p");
  counter.className = "fc-counter";
  counter.textContent = (currentCardIndex + 1) + " / " + currentDeckCards.length;
  var flagBtn = document.createElement("button");
  flagBtn.className = "flag-button" + (isFlashcardMarked(card) ? " red" : "");
  flagBtn.textContent = "⚑";
  flagBtn.title = "Marquer cette carte";
  flagBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    markFlashcard(card);
    flagBtn.className = "flag-button" + (isFlashcardMarked(card) ? " red" : "");
  });
  var topRow = document.createElement("div");
  topRow.className = "fc-top-row";
  topRow.appendChild(counter);
  topRow.appendChild(flagBtn);
  var hint = document.createElement("p");
  hint.className = "fc-hint";
  hint.textContent = "Cliquez sur la carte pour retourner";
  area.innerHTML = "";
  area.appendChild(topRow);
  area.appendChild(cardDiv);
  area.appendChild(hint);
  nav.innerHTML = "";
  if (currentCardIndex > 0) {
    var prevBtn = document.createElement("button");
    prevBtn.textContent = "◀ Précédent";
    prevBtn.onclick = function() { currentCardIndex--; renderCard(); };
    nav.appendChild(prevBtn);
  }
  if (currentCardIndex < currentDeckCards.length - 1) {
    var nextBtn = document.createElement("button");
    nextBtn.textContent = "Suivant ▶";
    nextBtn.onclick = function() { currentCardIndex++; renderCard(); };
    nav.appendChild(nextBtn);
  }
}

function flipCard() {
  var front = document.querySelector("#fcCard .fc-front");
  var back  = document.querySelector("#fcCard .fc-back");
  if (!front || !back) return;
  if (back.classList.contains("hidden")) {
    front.classList.add("hidden");
    back.classList.remove("hidden");
  } else {
    back.classList.add("hidden");
    front.classList.remove("hidden");
  }
}
