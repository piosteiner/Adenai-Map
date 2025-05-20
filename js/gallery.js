let currentImageIndex = 0;
let galleryImages = [];

// Called once on opening to populate state
function openGalleryModal() {
  const overlay = document.getElementById("galleryOverlay");
  if (!overlay) return;

  // Gather images only once per gallery open
  const modal = overlay.querySelector("#galleryModal");
  galleryImages = Array.from(modal.querySelectorAll(".thumbnail-strip img"));
  currentImageIndex = galleryImages.findIndex(img => img.classList.contains("active"));
  if (currentImageIndex === -1) currentImageIndex = 0;

  updateMainImage(currentImageIndex);
  overlay.style.display = "flex"; // use flex to center modal if needed
  overlay.setAttribute("data-open", "true");
}

function closeGalleryModal() {
  const overlay = document.getElementById("galleryOverlay");
  if (!overlay) return;
  overlay.style.display = "none";
  overlay.removeAttribute("data-open");
}

document.getElementById("galleryOverlay")?.addEventListener("click", function (e) {
  // Only close if click was on the overlay itself (not the modal inside it)
  if (window.innerWidth <= 768 && !e.target.closest(".gallery-modal")) {
    closeGalleryModal();
  }
});

// Replace the main image and update active state
function updateMainImage(index) {
  const modal = document.getElementById("galleryModal");
  if (!modal || !galleryImages.length) return;

  const mainImg = modal.querySelector(".main-image-container img");
  const selected = galleryImages[index];
  if (mainImg && selected) {
    mainImg.src = selected.src;
    mainImg.alt = selected.alt;
  }

  galleryImages.forEach((img, i) => img.classList.toggle("active", i === index));
  currentImageIndex = index;
}

// Event handlers for arrow buttons
function prevImage() {
  const newIndex = (currentImageIndex - 1 + galleryImages.length) % galleryImages.length;
  updateMainImage(newIndex);
}

function nextImage() {
  const newIndex = (currentImageIndex + 1) % galleryImages.length;
  updateMainImage(newIndex);
}

// Dragging logic
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

// Delegation for click events
document.addEventListener("click", function (e) {
  if (e.target.closest(".gallery-preview")) openGalleryModal();
  if (e.target.classList.contains("close-button")) closeGalleryModal();
  if (e.target.classList.contains("arrow")) {
    if (e.target.classList.contains("left")) prevImage();
    if (e.target.classList.contains("right")) nextImage();
  }
  if (e.target.closest(".thumbnail-strip img")) {
    const index = galleryImages.indexOf(e.target);
    if (index !== -1) updateMainImage(index);
  }
});

// Keyboard support
document.addEventListener("keydown", function (e) {
  const modal = document.getElementById("galleryModal");
  if (!modal || modal.style.display !== "block") return;

  if (e.key === "ArrowLeft") prevImage();
  else if (e.key === "ArrowRight") nextImage();
});

// Optional scroll support
document.getElementById("galleryModal")?.addEventListener("wheel", function (e) {
  e.preventDefault();
  if (e.deltaY > 0) nextImage();
  else prevImage();
}, { passive: false });
