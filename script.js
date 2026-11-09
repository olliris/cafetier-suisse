let quiz = [];

// Load quiz questions from questions.json
fetch("quiz_themes_1_a_5_complet.json")
  .then(response => {
    if (!response.ok) throw new Error("Chargement des quiz impossible");
    return response.json();
  })
  .then(data => {
    // Normalise "correct" en tableau (accepte 2 ou [2] dans le JSON)
    quiz = data.map(q => ({ ...q, correct: Array.isArray(q.correct) ? q.correct : [q.correct] }));
  })
  .catch(error => {
    console.error("Error loading quiz questions:", error);
    document.querySelector(".quiz-container p").textContent = "Impossible de charger les quiz. Rechargez la page pour réessayer.";
  });

let currentQuestion = 0;
let score = 0;
let mode = '';
let numQuestions = 90;
let shuffledQuiz = [];
let examHistory = JSON.parse(localStorage.getItem('examHistory')) || [];
let markedQuestions = JSON.parse(localStorage.getItem('markedQuestions')) || [];
let exerciseResults = JSON.parse(localStorage.getItem('exerciseResults')) || {};
let questionResults = JSON.parse(localStorage.getItem('questionResultsV1')) || {};
let currentRangeKey = ''; // Pour suivre la plage actuelle

// Sources : PCTN, Directives §§4.3, 8.1, 13.1 et 13.3.
// Effectifs de questions pédagogiques ; pondérations au milieu des fourchettes officielles.
const REAL_EXAM = [
  {title:"Thème 1 — Cadre légal genevois", minutes:30, count:15, groups:[{label:"Cadre légal", weight:100, modules:["1"]}]},
  {title:"Thème 2 — Autres lois et métiers", minutes:75, count:30, groups:[
    {label:"Alcool et dépendances",weight:20,modules:["2","3"]},
    {label:"Cuisine, service et boissons",weight:20,modules:["4","5"]},
    {label:"Incendie et premiers secours",weight:20,modules:["6","7"]},
    {label:"Santé et sécurité au travail",weight:20,modules:["8"]},
    {label:"Environnement",weight:20,modules:["9"]}]},
  {title:"Thème 3 — Sécurité et hygiène alimentaires",minutes:40,count:20,groups:[{label:"Hygiène alimentaire",weight:100,modules:["10"]}]},
  {title:"Thème 4 — Droit général et du travail",minutes:100,count:30,groups:[
    {label:"Salaire et assurances sociales",weight:20,kind:"salary"},
    {label:"Calcul du salaire (classement pédagogique)",weight:30,kind:"calculation"},
    {label:"Droit du travail",weight:30,modules:["13"]},
    {label:"Droit général",weight:20,modules:["14"]}]},
  {title:"Thème 5 — Comptabilité",minutes:45,count:20,groups:[
    {label:"Bases comptables et TVA",weight:50,kind:"accounting"},
    {label:"Gestion de l'entreprise (banque disponible)",weight:50,kind:"management"}]}
];
let examSubmitted = false, examThemeIndex = 0, examThemeResults = [];
let examTimer = null, examDeadline = 0;

function clearExamTimer() {
  if (examTimer !== null) clearInterval(examTimer);
  examTimer = null;
}
function examGrade(percentage) {
  return Math.round((1 + percentage * 5 / 100) * 2) / 2;
}
function isSalaryCalculation(q) {
  return /calcul|calculez|salaire brut journalier|salaire journalier/i.test(q.question);
}
function matchesExamGroup(q, group) {
  var key = getChapterKey(q);
  var module = key ? key.split(".")[0] : "";
  if (group.modules) return group.modules.includes(module);
  if (group.kind === "salary") return ["11","12"].includes(module) && !isSalaryCalculation(q);
  if (group.kind === "calculation") return ["11","12"].includes(module) && isSalaryCalculation(q);
  if (group.kind === "management") return key === "15.1";
  if (group.kind === "accounting") return ["15","16"].includes(module) && key !== "15.1";
  return false;
}
function pickExamQuestions(theme) {
  var previous;
  try { previous = new Set(JSON.parse(localStorage.getItem("previousExamTheme" + examThemeIndex)) || []); }
  catch(error) { previous = new Set(); }
  var used = new Set(), picked = [];
  theme.groups.forEach(function(group) {
    var pool = quiz.filter(function(q) { return matchesExamGroup(q, group) && !used.has(q.question); });
    pool = Array.from(new Map(pool.map(function(q) { return [q.question,q]; })).values());
    var count = Math.min(pool.length, Math.round(theme.count * group.weight / 100));
    if (!count) throw new Error("Matière absente : " + group.label);
    var fresh = shuffle(pool.filter(function(q) { return !previous.has(q.question); }));
    var old = shuffle(pool.filter(function(q) { return previous.has(q.question); }));
    fresh.concat(old).slice(0,count).forEach(function(q) {
      used.add(q.question);
      picked.push({...q, examGroup:group.label, examPoints:group.weight / count});
    });
  });
  picked = shuffle(picked);
  localStorage.setItem("previousExamTheme" + examThemeIndex, JSON.stringify(picked.map(function(q) { return q.question; })));
  return picked;
}
function startExam() {
  if (!quiz.length) { alert("Les questions ne sont pas encore chargées."); return; }
  examThemeIndex = 0;
  examThemeResults = [];
  startExamTheme();
}
function startExamTheme() {
  clearExamTimer();
  mode = "exam"; examSubmitted = false; currentQuestion = 0; score = 0;
  var theme = REAL_EXAM[examThemeIndex];
  try { shuffledQuiz = pickExamQuestions(theme); }
  catch(error) { alert(error.message); return; }
  numQuestions = shuffledQuiz.length;
  hideAll();
  document.getElementById("game").classList.remove("hidden");
  document.getElementById("score").classList.remove("hidden");
  document.getElementById("feedback").classList.add("hidden");
  var back = document.getElementById("backButton");
  if (back) back.remove();
  showQuestions();
  var notice = document.createElement("div");
  var title = document.createElement("h2"); title.textContent = theme.title;
  notice.appendChild(title);
  var info = document.createElement("p");
  info.textContent = numQuestions + " questions d'entraînement · " + theme.minutes + " min. Nombre non officiel. QCM issus de votre banque ; les champs libres et exercices complets de calcul ne sont pas reproduits.";
  notice.appendChild(info);
  var limits = document.createElement("p");
  limits.textContent = "Pondérations : " + theme.groups.map(function(g) { return g.label + " " + g.weight + "%"; }).join(" · ") +
    ". Correspondance des matières adaptée à la numérotation de votre cours ; couverture à vérifier pour le concordat sécurité, le calcul salarial et la gestion.";
  notice.appendChild(limits);
  var sources = document.createElement("p");
  sources.innerHTML = '<a href="https://www.ge.ch/document/7365/annexe/file/729513" target="_blank" rel="noopener">Directives PCTN</a> · <a href="https://www.ge.ch/document/7347/telecharger" target="_blank" rel="noopener">Pondérations PCTN</a>';
  notice.appendChild(sources);
  var timer = document.createElement("p"); timer.id = "examCountdown"; timer.setAttribute("role","timer");
  notice.appendChild(timer);
  document.getElementById("questions").prepend(notice);
  examDeadline = Date.now() + theme.minutes * 60000;
  function tick() {
    var seconds = Math.max(0,Math.ceil((examDeadline-Date.now())/1000));
    timer.textContent = "Temps restant : " + Math.floor(seconds/60) + ":" + String(seconds%60).padStart(2,"0");
    if (!seconds && !examSubmitted) endExam();
  }
  tick(); examTimer = setInterval(tick,1000);
  window.scrollTo(0,0);
}

// Mélange équitable (Fisher-Yates) sans modifier le tableau d'origine
function shuffle(array) {
  var copy = array.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
  }
  return copy;
}

function chooseExerciseRange() {
  window.scrollTo(0,0);
  if (!quiz.length) { alert("Les questions ne sont pas encore chargées."); return; }
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
  sep.textContent = "Choisissez un module ou un chapitre. Barre verte : questions répondues ; pourcentage : réussite sur les réponses validées.";
  markedRow.appendChild(sep);

  var exerciseRangeOptions = document.getElementById("exerciseRangeOptions");
  exerciseRangeOptions.innerHTML = "";

  getSyllabusWithQuestions().forEach(function(theme) {
    var themeTitle = document.createElement("h3");
    themeTitle.className = "exercise-theme-title";
    themeTitle.textContent = theme.title;
    exerciseRangeOptions.appendChild(themeTitle);

    theme.groups.forEach(function(group) {
      exerciseRangeOptions.appendChild(
        createExerciseButton(group.title, group.questions, "group-" + group.key, "exercise-range-btn exercise-theme-btn")
      );
      group.chapters.forEach(function(ch) {
        exerciseRangeOptions.appendChild(
          createExerciseButton((ch.key.endsWith(".final") ? "Quiz final du module" : "Chapitre " + ch.key), ch.questions, "chapter-" + ch.key, "exercise-range-btn")
        );
      });
    });
  });
}

// Plan du cours : thèmes → blocs de modules.
// Chaque question est rangée selon le numéro de module au début de son texte : "4.1.3. ..." → module 4, chapitre 4.1.
// Pour ajouter un module, il suffit d'ajouter ses questions numérotées dans questions.json.
const SYLLABUS = [
  { title: "Thème 1", groups: [
    { title: "Module 1 : Loi sur la restauration, le débit de boissons, l'hébergement et le divertissement (LRDBHD) et son règlement d'exécution (RRDBHD)", modules: ["1"] }
  ]},
  { title: "Thème 2", groups: [
    { title: "Modules 2, 3, 6 et 7 : Loi sur l'alcool, Alcool au volant/Drogues, Prévention incendies et Premiers secours", modules: ["2", "3", "6", "7"] },
    { title: "Module 4 Cuisine et Module 5 Service et Boissons", modules: ["4", "5"] },
    { title: "Module 8 Santé Sécurité au travail et Module 9 Déchets et aspects environnementaux", modules: ["8", "9"] }
  ]},
  { title: "Thème 3", groups: [
    { title: "Module 10 : Sécurité et hygiène alimentaire", modules: ["10"] }
  ]},
  { title: "Thème 4", groups: [
    { title: "Modules 11 et 12 : Assurances sociales et salaires", modules: ["11", "12"] },
    { title: "Module 13 : Droit du travail", modules: ["13"] },
    { title: "Module 14 : Connaissance générale du droit", modules: ["14"] }
  ]},
  { title: "Thème 5", groups: [
    { title: "Modules 15 et 16 : Comptabilité", modules: ["15", "16"] }
  ]}
];

// Numéro de chapitre lu au début de la question : "4.1.3. ..." → "4.1"
function getChapterKey(q) {
  var match = q.question.match(/^\s*(\d+)\.(\d+)\./);
  if (match) return match[1] + "." + match[2];
  // Les quiz finaux indiquent leur module/chapitre entre crochets.
  var finalMatch = q.question.match(/^Final\s+M[^[]*\[(\d+)(?:\.(\d+))?(?:\.\d+)*\]/i);
  return finalMatch ? finalMatch[1] + "." + (finalMatch[2] || "final") : null;
}

// Regroupe les questions par chapitre, dans l'ordre du fichier
function groupByChapter(questions) {
  var chapters = [];
  questions.forEach(function(q) {
    var key = getChapterKey(q);
    var chapter = chapters.find(function(c) { return c.key === key; });
    if (!chapter) { chapter = { key: key, questions: [] }; chapters.push(chapter); }
    chapter.questions.push(q);
  });
  return chapters;
}

// Associe les questions au plan du cours ; les thèmes et blocs sans questions sont masqués
function getSyllabusWithQuestions() {
  var used = new Set();
  var result = SYLLABUS.map(function(theme) {
    var moduleGroups = theme.groups.flatMap(function(group) {
      if (group.modules.join("-") === "11-12") return [group];
      return group.modules.map(function(module) {
        return { title: group.modules.length === 1 ? group.title : "Module " + module + " — " + group.title.replace(/^Modules?[^:]*:\\s*/, ""), modules: [module] };
      });
    });
    moduleGroups.sort(function(a, b) { return Number(a.modules[0]) - Number(b.modules[0]); });
    var groups = moduleGroups.map(function(group) {
      var questions = quiz.filter(function(q) {
        var key = getChapterKey(q);
        return key && group.modules.includes(key.split(".")[0]);
      });
      questions.forEach(function(q) { used.add(q); });
      return { title: group.title, key: group.modules.join("-"), questions: questions, chapters: groupByChapter(questions) };
    }).filter(function(group) { return group.questions.length > 0; });
    return { title: theme.title, groups: groups };
  }).filter(function(theme) { return theme.groups.length > 0; });

  // Questions sans numéro de module reconnu : regroupées à la fin pour ne jamais les perdre
  var others = quiz.filter(function(q) { return !used.has(q); });
  if (others.length) {
    result.push({ title: "Autres", groups: [{ title: "Autres questions", key: "autres", questions: others, chapters: [] }] });
  }
  return result;
}

// ── Syllabus : la théorie, classée selon le même plan que le QCM ──
// Le contenu vient de syllabus.json : [{ "chapter": "4.1", "title": "...", "content": "..." }]
let syllabusChapters = null;

function showSyllabus() {
  window.scrollTo(0,0);
  hideAll();
  document.getElementById("syllabusPage").classList.remove("hidden");
  if (syllabusChapters) { renderSyllabusPlan(); return; }
  fetch("syllabus.json")
    .then(function(response) { return response.json(); })
    .then(function(data) { syllabusChapters = data; renderSyllabusPlan(); })
    .catch(function(error) {
      console.error("Error loading syllabus:", error);
      document.getElementById("syllabusContent").textContent = "Impossible de charger le syllabus.";
    });
}

function getSyllabusChapters(group) {
  return syllabusChapters.filter(function(ch) {
    return group.modules.includes(String(ch.chapter).split(".")[0]);
  });
}

// Plan complet du cours ; les blocs sans théorie sont affichés mais désactivés
function renderSyllabusPlan() {
  window.scrollTo(0,0);
  var container = document.getElementById("syllabusContent");
  container.innerHTML = "";
  SYLLABUS.forEach(function(theme) {
    var themeTitle = document.createElement("h3");
    themeTitle.className = "exercise-theme-title";
    themeTitle.textContent = theme.title;
    container.appendChild(themeTitle);
    theme.groups.forEach(function(group) {
      var chapters = getSyllabusChapters(group);
      var hasContent = chapters.some(function(ch) { return ch.content && ch.content.trim(); });
      var button = document.createElement("button");
      button.className = "exercise-range-btn";
      button.textContent = group.title + (hasContent ? "" : " (à venir)");
      button.disabled = !hasContent;
      button.onclick = function() { openSyllabusGroup(group, chapters); };
      container.appendChild(button);
    });
  });
}

function openSyllabusGroup(group, chapters) {
  window.scrollTo(0,0);
  var container = document.getElementById("syllabusContent");
  container.innerHTML = "";
  var title = document.createElement("h3");
  title.textContent = group.title;
  container.appendChild(title);
  chapters.forEach(function(ch) {
    var chapterTitle = document.createElement("h4");
    chapterTitle.textContent = ch.chapter + (ch.title ? " – " + ch.title : "");
    var text = document.createElement("p");
    text.className = "syllabus-text";
    text.textContent = ch.content && ch.content.trim() ? ch.content : "Contenu à venir.";
    container.appendChild(chapterTitle);
    container.appendChild(text);
  });
  var back = document.createElement("button");
  back.textContent = "Retour au syllabus";
  back.onclick = renderSyllabusPlan;
  container.appendChild(back);
}

function createExerciseButton(label, questions, resultKey, className) {
  var button = document.createElement("button");
  button.className = className;
  var stats = getQuestionStats(questions);
  var title = document.createElement("span");
  title.textContent = label + " (" + questions.length + " q.)";
  var summary = document.createElement("span");
  summary.className = "exercise-progress-summary";
  summary.textContent = (stats.answered ? stats.success + "% de réussite" : "Pas encore de résultat") +
    " · " + stats.answered + "/" + questions.length + " répondues";
  button.appendChild(title);
  button.appendChild(summary);
  button.appendChild(createProgressBar(stats, questions.length));
  button.onclick = function() { startExercise(questions, resultKey); };
  return button;
}

// Une question compte une seule fois ; une nouvelle tentative remplace son résultat.
function getQuestionStats(questions) {
  var answered = 0, correct = 0;
  questions.forEach(function(q) {
    if (Object.prototype.hasOwnProperty.call(questionResults, q.question)) {
      answered++;
      if (questionResults[q.question]) correct++;
    }
  });
  return { answered: answered, correct: correct,
    success: answered ? Math.round(correct / answered * 100) : 0 };
}

function createProgressBar(stats, total) {
  var bar = document.createElement("span");
  bar.className = "exercise-progress";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Questions répondues");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(total));
  bar.setAttribute("aria-valuenow", String(stats.answered));
  var fill = document.createElement("span");
  fill.className = "exercise-progress-fill";
  fill.style.width = (total ? stats.answered / total * 100 : 0) + "%";
  bar.appendChild(fill);
  return bar;
}

function recordQuestionResult(q, correct) {
  questionResults[q.question] = correct;
  localStorage.setItem("questionResultsV1", JSON.stringify(questionResults));
}

function renderExerciseProgress() {
  var element = document.getElementById("moduleProgress");
  if (!element) {
    element = document.createElement("div");
    element.id = "moduleProgress";
    document.getElementById("game").insertBefore(element, document.getElementById("questions"));
  }
  element.innerHTML = "";
  element.classList.toggle("hidden", mode !== "exercise");
  if (mode !== "exercise") return;
  var stats = getQuestionStats(shuffledQuiz);
  var summary = document.createElement("p");
  summary.textContent = (stats.answered ? stats.success + "% de réussite" : "Pas encore de résultat") +
    " · " + stats.answered + "/" + numQuestions + " répondues";
  element.appendChild(summary);
  element.appendChild(createProgressBar(stats, numQuestions));
}

function startExercise(questions, resultKey) {
  mode = 'exercise';
  numQuestions = questions.length;
  shuffledQuiz = shuffle(questions);
  currentRangeKey = resultKey; // clé utilisée pour enregistrer le % de réussite

  hideAll();
  document.getElementById("game").classList.remove("hidden");
  currentQuestion = 0;
  score = 0;
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
  const flagButton = Array.from(document.querySelectorAll(".flag-button")).find(button => button.dataset.question === question.question);
  if (flagButton) {
    const isMarked = markedQuestions.some(markedQ => markedQ.question === question.question);
    flagButton.classList.toggle("red", isMarked);
    flagButton.textContent = "⚑";
  }
}

function showQuestions() {
  renderExerciseProgress();
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
  renderExerciseProgress();
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

function showExplanation(questionDiv, q) {
  if (!q.explanation || questionDiv.querySelector(".explanation")) return;
  const explanationElem = document.createElement("p");
  explanationElem.className = "explanation";
  explanationElem.textContent = q.explanation;
  questionDiv.appendChild(explanationElem);
}

function checkAnswer(questionIndex) {
  const q = shuffledQuiz[questionIndex];
  const questionDiv = document.querySelector("#questions .question:nth-child(1)");
  if (questionDiv.dataset.answered) return;
  questionDiv.dataset.answered = "true";
  const buttons = questionDiv.querySelectorAll(".answer-button");
  buttons.forEach(function(button) { button.disabled = true; });
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
  showExplanation(questionDiv, q);
  const correctSelected = candidateSelected.filter(ans => q.correct.includes(ans)).length;
  const incorrectSelected = candidateSelected.length - correctSelected;
  const isCorrect = correctSelected === q.correct.length && incorrectSelected === 0;
  if (isCorrect) score++;
  recordQuestionResult(q, isCorrect);
  renderExerciseProgress();
  document.getElementById("score").textContent = `Score: ${score}/${numQuestions}`;
}

function endExam() {
  if (examSubmitted) return;
  examSubmitted = true;
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
    showExplanation(questionDiv, q);

    // Calculer le score
    const correctSelected = candidateSelected.filter(ans => q.correct.includes(ans)).length;
    const incorrectSelected = candidateSelected.length - correctSelected;
    const isCorrect = (correctSelected === q.correct.length && incorrectSelected === 0);
    
    questionDiv.dataset.examCorrect = String(isCorrect);
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
  clearExamTimer();
  var points = 0;
  questionDivs.forEach(function(div,index) {
    if (div.dataset.examCorrect === "true") points += shuffledQuiz[index].examPoints;
    div.querySelectorAll(".answer-button").forEach(function(button) { button.disabled = true; });
  });
  var percentage = Math.max(0,Math.min(100,points));
  var grade = examGrade(percentage);
  var result = {theme:examThemeIndex+1, percentage:percentage, grade:grade};
  examThemeResults.push(result);
  document.getElementById("feedback").textContent = grade >= 4 ? "Thème réussi" : "Thème non réussi";
  document.getElementById("feedback").className = "feedback-text " + (grade>=4 ? "green":"red");
  document.getElementById("score").textContent = "Résultat pondéré : " + percentage.toFixed(1) + "% · Note : " + grade + "/6";
  document.getElementById("endButton").classList.add("hidden");
  var next = document.createElement("button"); next.id = "backButton";
  if (examThemeIndex < REAL_EXAM.length-1) {
    next.textContent = "Commencer le thème suivant";
    next.onclick = function() { examThemeIndex++; startExamTheme(); };
  } else {
    var passed = examThemeResults.every(function(r) { return r.grade>=4; });
    document.getElementById("feedback").textContent = passed ? "Examen blanc réussi : chaque thème atteint 4/6." : "Examen blanc non réussi : au moins un thème est inférieur à 4/6.";
    var recap = document.createElement("ul");
    examThemeResults.forEach(function(r) {
      var line = document.createElement("li");
      line.textContent = "Thème " + r.theme + " : " + r.grade + "/6 (" + r.percentage.toFixed(1) + "%)";
      recap.appendChild(line);
    });
    document.getElementById("questions").appendChild(recap);
    examHistory.push({date:new Date().toISOString(),themes:examThemeResults.slice(),passed:passed});
    localStorage.setItem("examHistory",JSON.stringify(examHistory));
    next.textContent = "Retour à l'accueil"; next.onclick = resetQuiz;
  }
  document.getElementById("game").appendChild(next);
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
  clearExamTimer();
  currentQuestion = 0;
  score = 0;
  mode = '';
  numQuestions = 50;
  shuffledQuiz = [];
  currentRangeKey = '';
  document.getElementById("game").classList.add("hidden");
  document.querySelector(".quiz-container").classList.remove("hidden");
  document.getElementById("footer").style.display = "block";
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
    listItem.textContent = typeof score === "number" ? `Ancien examen ${index + 1}: ${score.toFixed(2)}%` : "Examen " + (index+1) + " : " + (score.passed ? "réussi" : "non réussi") + " · " + score.themes.map(function(r) { return "T" + r.theme + " : " + r.grade + "/6"; }).join(" · ");
    historyList.appendChild(listItem);
  });
  historyContent.appendChild(historyList);
}

function goBackToHome() {
  clearExamTimer();
  window.scrollTo(0,0);
  var ids = ["game","exerciseRangePage","syllabusPage","historyPage","flashcardsPage","flashcardDeckPage","schemasPage","schemasCategoryPage","schemaDetailPage"];
  ids.forEach(function(id) { document.getElementById(id).classList.add("hidden"); });
  document.querySelector(".quiz-container").classList.remove("hidden");
  document.getElementById("footer").style.display = "block";
}

function hideAll() {
  var ids = ["game","exerciseRangePage","syllabusPage","historyPage","flashcardsPage","flashcardDeckPage","schemasPage","schemasCategoryPage","schemaDetailPage"];
  ids.forEach(function(id) { document.getElementById(id).classList.add("hidden"); });
  document.querySelector(".quiz-container").classList.add("hidden");
  document.getElementById("footer").style.display = "none";
}

function resetCache() {
  localStorage.removeItem('examHistory');
  localStorage.removeItem("previousExamQuestions");
  localStorage.removeItem('markedQuestions');
  localStorage.removeItem('exerciseResults');
  localStorage.removeItem('questionResultsV1');
  questionResults = {};
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
