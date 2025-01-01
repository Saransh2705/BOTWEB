document.addEventListener('DOMContentLoaded', () => {
  const userAvatar = document.getElementById('user-avatar');
  const sidebar = document.getElementById('sidebar');
  const closeSidebar = document.getElementById('close-sidebar');

  if (userAvatar) {
    userAvatar.addEventListener('click', () => {
      sidebar.style.display = 'block';
    });
  }

  if (closeSidebar) {
    closeSidebar.addEventListener('click', () => {
      sidebar.style.display = 'none';
    });
  }
});



 //dropdown
 document.getElementById('selected-option').addEventListener('click', function () {
  const dropdownOptions = document.getElementById('dropdown-options');
  const arrowIcon = document.getElementById('arrow-icon');
  if (dropdownOptions.style.display === 'block') {
      dropdownOptions.style.display = 'none';
      arrowIcon.classList.remove('rotate');
  } else {
      dropdownOptions.style.display = 'block';
      arrowIcon.classList.add('rotate');
  }
});

document.querySelectorAll('.option').forEach(option => {
  option.addEventListener('click', function () {
      const value = this.getAttribute('data-value');
      window.location.href = value;
  });
});

window.onclick = function (event) {
  if (!event.target.closest('.custom-dropdown')) {
      const dropdownOptions = document.getElementById('dropdown-options');
      const arrowIcon = document.getElementById('arrow-icon');
      if (dropdownOptions.style.display === 'block') {
          dropdownOptions.style.display = 'none';
          arrowIcon.classList.remove('rotate');
      }
  }
};


