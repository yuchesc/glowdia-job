window.addEventListener('load', function() {
    const u = localStorage.getItem('u');
    const p = localStorage.getItem('p');
    if (u && p) {
        document.getElementById('MainContent_txtStaffNo').value = u;
        document.getElementById('MainContent_txtPwd').value = p;
        document.getElementById('MainContent_ibtLogin').click();
    } else {
        document.getElementById('MainContent_ibtLogin').addEventListener('click', () => {
            console.log('save login data');
            localStorage.setItem('u', document.getElementById('MainContent_txtStaffNo').value);
            localStorage.setItem('p', document.getElementById('MainContent_txtPwd').value);
        });
    }
}, false);
