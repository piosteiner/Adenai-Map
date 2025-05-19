let currentImageIndex = 0;
let galleryImages = [];

// Called once on opening to populate state
function openGalleryModal() {
  const modal = document.getElementById("galleryModal");
  if (!modal) return;

  // Collect all images in thumbnail strip
  galleryImages = Array.from(modal.querySelectorAll(".thumbnail-strip img"));
  if (galleryImages.length === 0) return;

  currentImageIndex = galleryImages.findIndex(img => img.classList.contains("active"));
  if (currentImageIndex === -1) currentImageIndex = 0;

  updateMainImage(currentImageIndex);
  modal.style.display = "block";
  modal.setAttribute("data-open", "true");
}

function closeGalleryModal() {
  const modal = document.getElementById("galleryModal");
  if (!modal) return;

  modal.style.display = "none";
  modal.removeAttribute("data-open");
}

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

let arrowTimeout;

function showArrows() {
  const arrows = document.querySelectorAll('.arrow');
  arrows.forEach(arrow => arrow.classList.remove('hidden'));

  clearTimeout(arrowTimeout);
  arrowTimeout = setTimeout(() => {
    arrows.forEach(arrow => arrow.classList.add('hidden'));
  }, 3000);
}



// Show arrows on modal open
document.addEventListener("click", function (e) {
  if (e.target.closest(".gallery-preview")) {
    openGalleryModal();
    showArrows();
  }
});

// Reset visibility on any interaction with the modal
document.getElementById("galleryModal")?.addEventListener("mousemove", showArrows);
document.getElementById("galleryModal")?.addEventListener("keydown", showArrows);

function navigateGallery(direction) {
  const thumbnails = document.querySelectorAll(".thumbnail-strip img");
  if (thumbnails.length === 0) return;

  let activeIndex = Array.from(thumbnails).findIndex(img => img.classList.contains("active"));
  if (activeIndex === -1) activeIndex = 0;

  let newIndex = (activeIndex + direction + thumbnails.length) % thumbnails.length;
  updateMainImage(newIndex);
}



// Scroll wheel for navigating images
document.getElementById("galleryModal")?.addEventListener("wheel", function (e) {
  e.preventDefault();
  if (e.deltaY > 0) {
    navigateGallery(1); // Scroll down → next image
  } else {
    navigateGallery(-1); // Scroll up → previous image
  }
}, { passive: false });