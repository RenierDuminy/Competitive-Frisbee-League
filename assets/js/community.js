    document.addEventListener('DOMContentLoaded', () => {
      const now   = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end   = new Date(now.getFullYear() + 1, 0, 1);
      const pct   = Math.min(100, Math.max(0, (now - start)/(end - start)*100));

      // Position every .year-pointer under each container
      document.querySelectorAll('.progress-container .year-pointer')
        .forEach(ptr => {
          ptr.style.left = pct + '%';
        });
    });