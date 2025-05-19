function openGalleryModal() {
  document.getElementById("galleryModal").style.display = "block";
}

function closeGalleryModal() {
  document.getElementById("galleryModal").style.display = "none";
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
