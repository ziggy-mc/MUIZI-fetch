const sampleUsernames = [
  "Notch",
  "Dream",
  "Technoblade",
  "Herobrine",
  "CaptainSparklez",
  "Skeppy",
  "GeorgeNotFound",
];

const validCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_";
const maxUsernameLength = 16;
const suggestionLimit = 5;

const form = document.getElementById("lookupForm");
const usernameInput = document.getElementById("usernameInput");
const suggestionsList = document.getElementById("suggestions");
const submitButton = document.getElementById("submitButton");
const loadingState = document.getElementById("loading");

let redirectUrl = "https://example.com";
let loadingActive = false;

function randomChar() {
  const index = Math.floor(Math.random() * validCharacters.length);
  return validCharacters[index];
}

function fillRandomSuffix(base) {
  let value = base;
  while (value.length < Math.min(maxUsernameLength, Math.max(3, base.length + 3))) {
    value += randomChar();
  }
  return value.slice(0, maxUsernameLength);
}

function getSuggestions(value) {
  if (!value) {
    return [];
  }

  const fromStaticList = sampleUsernames
    .filter((name) => name.toLowerCase().startsWith(value.toLowerCase()))
    .slice(0, suggestionLimit);

  const generated = [];
  while (generated.length < suggestionLimit) {
    const suggestion = fillRandomSuffix(value);
    if (!fromStaticList.includes(suggestion) && !generated.includes(suggestion)) {
      generated.push(suggestion);
    }
  }

  return [...fromStaticList, ...generated].slice(0, suggestionLimit);
}

function renderSuggestions(suggestions) {
  suggestionsList.innerHTML = "";
  suggestions.forEach((suggestion) => {
    const item = document.createElement("li");
    item.textContent = suggestion;
    item.addEventListener("click", () => {
      if (loadingActive) {
        return;
      }
      usernameInput.value = suggestion;
      suggestionsList.innerHTML = "";
      usernameInput.focus();
    });
    suggestionsList.appendChild(item);
  });
}

function setLoadingState(isLoading) {
  loadingActive = isLoading;
  const controls = form.querySelectorAll("input, button");
  controls.forEach((control) => {
    control.disabled = isLoading;
  });
  if (isLoading) {
    suggestionsList.innerHTML = "";
  }
  loadingState.classList.toggle("hidden", !isLoading);
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    if (response.ok) {
      const config = await response.json();
      redirectUrl = config.redirectUri || redirectUrl;
    }
  } catch {
    redirectUrl = redirectUrl;
  }
}

usernameInput.addEventListener("input", () => {
  const inputValue = usernameInput.value.trim();
  renderSuggestions(getSuggestions(inputValue));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const inputValue = usernameInput.value.trim();
  if (!inputValue) {
    return;
  }

  setLoadingState(true);
  try {
    const response = await fetch("/api/fetch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: inputValue }),
    });

    const payload = await response.json().catch(() => ({}));
    const destination = payload.redirectUri || redirectUrl;
    window.location.assign(destination);
  } catch {
    window.location.assign(redirectUrl);
  }
});

loadConfig();
