function openGalleryModal() {
  const modal = document.getElementById("galleryModal");
  if (modal) {
    modal.style.display = "block";
    modal.setAttribute("data-open", "true");
  }
}

function closeGalleryModal() {
  const modal = document.getElementById("galleryModal");
  if (modal) {
    modal.style.display = "none";
    modal.removeAttribute("data-open");
  }
}

// Draggable logic
let offsetX, offsetY, isDragging = false;

function dragStart(e) {
  const modal = document.getElementById("galleryModal");
  offsetX = e.clientX - modal.offsetLeft;
  offsetY = e.clientY - modal.offsetTop;
  isDragging = true;

  document.addEventListener("mousemove", dragMove);
  document.addEventListener("mouseup", dragEnd);
}

function dragMove(e) {
  if (!isDragging) return;
  const modal = document.getElementById("galleryModal");
  modal.style.left = `${e.clientX - offsetX}px`;
  modal.style.top = `${e.clientY - offsetY}px`;
}

function dragEnd() {
  isDragging = false;
  document.removeEventListener("mousemove", dragMove);
  document.removeEventListener("mouseup", dragEnd);
}

// ✅ Prevent clicks inside the modal from bubbling up and triggering unwanted behavior
document.getElementById("galleryModal")?.addEventListener("click", function (e) {
  e.stopPropagation();
});

// ✅ Event delegation to handle dynamic or Leaflet-injected HTML
document.addEventListener("click", function (e) {
  // Open gallery when preview or label is clicked
  if (e.target.closest(".gallery-preview")) {
    openGalleryModal();
  }

  // Close gallery when X button is clicked
  if (e.target.classList.contains("close-button")) {
    closeGalleryModal();
  }
});

// ✅ Optional safeguard: prevent accidental Leaflet map clicks from closing modal
if (typeof map !== 'undefined') {
  map.on('popupclose', () => {
    const modal = document.getElementById("galleryModal");
    if (modal?.getAttribute("data-open") === "true") {
      // Prevent automatic closing if modal is open
      setTimeout(() => modal.style.display = "block", 0);
    }
  });
}