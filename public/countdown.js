(function () {
  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function setText(root, name, value) {
    var element = root.querySelector("[data-countdown='" + name + "']");
    if (element) {
      element.textContent = pad(value);
    }
  }

  function updateCountdown() {
    var root = document.getElementById("hackathon-countdown");
    if (!root) {
      return false;
    }

    var endTime = Number(root.dataset.endTime);
    var difference = Math.max(0, endTime - Date.now());

    setText(root, "days", Math.floor(difference / 86400000));
    setText(root, "hours", Math.floor((difference / 3600000) % 24));
    setText(root, "minutes", Math.floor((difference / 60000) % 60));
    setText(root, "seconds", Math.floor((difference / 1000) % 60));

    return true;
  }

  function startCountdown() {
    if (window.__hackathonCountdownTimer) {
      window.clearInterval(window.__hackathonCountdownTimer);
    }

    updateCountdown();
    window.__hackathonCountdownTimer = window.setInterval(updateCountdown, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startCountdown);
  } else {
    startCountdown();
  }

  window.addEventListener("pageshow", startCountdown);
})();
