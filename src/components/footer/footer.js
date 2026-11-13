const year = document.querySelector("[data-year]");

if (year) {
  const now = String(new Date().getFullYear());
  year.textContent = now;
  year.dateTime = now;
}
