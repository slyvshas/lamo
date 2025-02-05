
// Adding zoom effect on hover
const profilePic = document.getElementById('profile-pic');

profilePic.addEventListener('mouseover', function () {
    profilePic.style.transform = 'scale(1.2)';
});

profilePic.addEventListener('mouseout', function () {
    profilePic.style.transform = 'scale(1)';
});