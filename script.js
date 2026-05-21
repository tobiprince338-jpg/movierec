// ============================================
        // CONFIGURATION - PUT YOUR API KEY HERE
        // ============================================
        const CONFIG = {
            // Get your free API key from: https://www.themoviedb.org/settings/api
            TMDB_API_KEY: '3adfa032f986b62be5418f395d31de9c', // <-- REPLACE THIS WITH YOUR KEY
            
            BASE_URL: 'https://api.themoviedb.org/3',
            IMG_URL: 'https://image.tmdb.org/t/p',
            LANGUAGE: 'en-US',
            
            // YouTube trailer base URL
            YOUTUBE_URL: 'https://www.youtube.com/embed/',
            
            // Sample thriller video URLs (replace with your own hosted videos)
            SAMPLE_VIDEOS: {
                default: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
                action: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                horror: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
            }
        };

        const THRILLER_ID = 53;
        const GENRE_MAP = {
            28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
            80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
            14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
            9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 53: 'Thriller',
            10752: 'War', 37: 'Western'
        };

        // State
        let moviesDB = [];
        let watchlist = JSON.parse(localStorage.getItem('thrillstream_watchlist')) || [];
        let currentFilter = '53';
        let currentModalMovie = null;
        let currentHeroMovie = null;
        let currentPage = 1;
        let heroMovies = [];
        let currentHeroIndex = 0;
        let currentPlayingMovie = null;

        // DOM Elements
        const trendingGrid = document.getElementById('trendingGrid');
        const moviesGrid = document.getElementById('moviesGrid');
        const recommendedGrid = document.getElementById('recommendedGrid');
        const watchlistGrid = document.getElementById('watchlistGrid');
        const searchInput = document.getElementById('searchInput');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const movieModal = new bootstrap.Modal(document.getElementById('movieModal'));
        const videoPlayerOverlay = document.getElementById('videoPlayerOverlay');
        const videoWrapper = document.getElementById('videoWrapper');

        // ============================================
        // API FUNCTIONS
        // ============================================

        function checkApiKey() {
            if (CONFIG.TMDB_API_KEY === 'YOUR_TMDB_API_KEY_HERE') {
                showToast('Please add your TMDB API key!', 'error');
                console.error('ERROR: Set your TMDB API key in the CONFIG object.');
                return false;
            }
            return true;
        }

        async function fetchFromTMDB(endpoint, params = '') {
            if (!checkApiKey()) return null;
            
            try {
                const url = `${CONFIG.BASE_URL}${endpoint}?api_key=${CONFIG.TMDB_API_KEY}&language=${CONFIG.LANGUAGE}${params}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                return await response.json();
            } catch (error) {
                console.error('API Error:', error);
                showToast('Failed to fetch thriller data.', 'error');
                return null;
            }
        }

        async function fetchThrillers(page = 1, additionalGenres = '') {
            const genreFilter = additionalGenres ? additionalGenres : THRILLER_ID;
            const data = await fetchFromTMDB('/discover/movie', 
                `&with_genres=${genreFilter}&sort_by=popularity.desc&page=${page}&vote_count.gte=50`);
            return data ? data.results : [];
        }

        async function fetchTopThrillers(page = 1) {
            const data = await fetchFromTMDB('/discover/movie',
                `&with_genres=${THRILLER_ID}&sort_by=vote_average.desc&vote_count.gte=200&page=${page}`);
            return data ? data.results : [];
        }

        async function searchThrillers(query, page = 1) {
            const data = await fetchFromTMDB('/search/movie', 
                `&query=${encodeURIComponent(query)}&page=${page}`);
            return data ? data.results : [];
        }

        async function fetchMovieDetails(movieId) {
            const data = await fetchFromTMDB(`/movie/${movieId}`, '&append_to_response=credits,videos');
            return data;
        }

        // ============================================
        // VIDEO PLAYER FUNCTIONS
        // ============================================

        async function playMovie(movieId) {
            if (!movieId) {
                showToast('No movie selected', 'error');
                return;
            }

            const movie = moviesDB.find(m => m.id === movieId);
            if (!movie) {
                showToast('Movie not found', 'error');
                return;
            }

            currentPlayingMovie = movie;
            document.getElementById('videoPlayerTitle').textContent = movie.title;

            // Close movie modal if open
            movieModal.hide();

            // Show loading
            loadingSpinner.classList.remove('hidden');

            // Fetch movie details to get trailer
            const details = await fetchMovieDetails(movieId);
            
            let videoUrl = null;
            let videoType = 'trailer'; // 'trailer' or 'sample'

            // Check for YouTube trailer
            if (details && details.videos && details.videos.results) {
                const trailer = details.videos.results.find(v => 
                    v.type === 'Trailer' && v.site === 'YouTube'
                );
                if (trailer) {
                    videoUrl = CONFIG.YOUTUBE_URL + trailer.key + '?autoplay=1&rel=0';
                    videoType = 'trailer';
                }
            }

            // Fallback to sample video if no trailer
            if (!videoUrl) {
                videoUrl = CONFIG.SAMPLE_VIDEOS.default;
                videoType = 'sample';
            }

            // Render video player
            renderVideoPlayer(videoUrl, videoType);
            
            loadingSpinner.classList.add('hidden');
            videoPlayerOverlay.classList.add('active');
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        }

        function renderVideoPlayer(url, type) {
            videoWrapper.innerHTML = '';

            if (type === 'trailer') {
                // YouTube iframe
                videoWrapper.innerHTML = `
                    <iframe 
                        src="${url}" 
                        title="Movie Trailer" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                `;
            } else {
                // HTML5 video player with custom controls
                videoWrapper.innerHTML = `
                    <video class="custom-video-player" id="customVideo" controls autoplay>
                        <source src="${url}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                `;
            }
        }

        function closeVideoPlayer() {
            videoPlayerOverlay.classList.remove('active');
            videoWrapper.innerHTML = ''; // Stop video playback
            document.body.style.overflow = '';
            currentPlayingMovie = null;
        }

        function toggleFullscreen() {
            const videoElement = videoWrapper.querySelector('iframe, video');
            if (!videoElement) return;

            if (!document.fullscreenElement) {
                if (videoElement.requestFullscreen) {
                    videoElement.requestFullscreen();
                } else if (videoElement.webkitRequestFullscreen) {
                    videoElement.webkitRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        }

        // Close video player on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && videoPlayerOverlay.classList.contains('active')) {
                closeVideoPlayer();
            }
        });

        // ============================================
        // DATA MAPPING
        // ============================================

        function mapMovieData(tmdbMovie) {
            const genres = tmdbMovie.genre_ids 
                ? tmdbMovie.genre_ids.map(id => GENRE_MAP[id] || 'Unknown')
                : (tmdbMovie.genres ? tmdbMovie.genres.map(g => g.name) : []);
            
            return {
                id: tmdbMovie.id,
                title: tmdbMovie.title,
                year: tmdbMovie.release_date ? new Date(tmdbMovie.release_date).getFullYear() : 'N/A',
                rating: tmdbMovie.vote_average ? tmdbMovie.vote_average.toFixed(1) : 'N/A',
                duration: tmdbMovie.runtime ? formatRuntime(tmdbMovie.runtime) : 'N/A',
                genre: genres,
                genreIds: tmdbMovie.genre_ids || [],
                poster: tmdbMovie.poster_path 
                    ? `${CONFIG.IMG_URL}/w500${tmdbMovie.poster_path}`
                    : 'https://via.placeholder.com/500x750?text=No+Poster',
                backdrop: tmdbMovie.backdrop_path
                    ? `${CONFIG.IMG_URL}/original${tmdbMovie.backdrop_path}`
                    : 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=1920',
                desc: tmdbMovie.overview || 'No description available.',
                cast: tmdbMovie.credits?.cast?.slice(0, 5).map(c => c.name) || [],
                trailerKey: tmdbMovie.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key || null
            };
        }

        function formatRuntime(minutes) {
            if (!minutes) return 'N/A';
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return `${hours}h ${mins}min`;
        }

        // ============================================
        // RENDER FUNCTIONS
        // ============================================

        function createMovieCard(movie, showBadge = false) {
            const inWatchlist = watchlist.includes(movie.id);
            return `
                <div class="col-6 col-md-4 col-lg-3 animate-in">
                    <div class="movie-card" onclick="openMovieModal(${movie.id})">
                        ${showBadge && inWatchlist ? '<div class="watchlist-badge"><i class="bi bi-check"></i></div>' : ''}
                        <img src="${movie.poster}" class="card-img-top" alt="${movie.title}" loading="lazy" 
                             onerror="this.src='https://via.placeholder.com/500x750?text=No+Poster'">
                        <div class="movie-actions">
                            <button class="btn-action" onclick="event.stopPropagation(); playMovie(${movie.id})" 
                                    title="Watch Now">
                                <i class="bi bi-play-fill"></i>
                            </button>
                            <button class="btn-action" onclick="event.stopPropagation(); toggleWatchlist(${movie.id})" 
                                    title="${inWatchlist ? 'Remove from' : 'Add to'} Watchlist">
                                <i class="bi ${inWatchlist ? 'bi-bookmark-check-fill' : 'bi-plus-lg'}"></i>
                            </button>
                            <button class="btn-action" onclick="event.stopPropagation(); openMovieModal(${movie.id})" title="More Info">
                                <i class="bi bi-info-lg"></i>
                            </button>
                        </div>
                        <div class="movie-overlay">
                            <div class="movie-title">${movie.title}</div>
                            <div class="movie-meta">
                                <span class="movie-rating"><i class="bi bi-star-fill"></i> ${movie.rating}</span>
                                <span>${movie.year}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        function renderTrending() {
            const trending = moviesDB.slice(0, 4);
            trendingGrid.innerHTML = trending.length 
                ? trending.map(m => createMovieCard(m, true)).join('')
                : '<div class="col-12 text-center text-muted">No thrillers found</div>';
        }

        function renderMovies() {
            moviesGrid.innerHTML = moviesDB.length
                ? moviesDB.map(m => createMovieCard(m)).join('')
                : '<div class="col-12 text-center text-muted py-5">No thrillers found</div>';
        }

        function renderRecommended() {
            const shuffled = [...moviesDB].sort(() => 0.5 - Math.random()).slice(0, 4);
            recommendedGrid.innerHTML = shuffled.length
                ? shuffled.map(m => createMovieCard(m)).join('')
                : '<div class="col-12 text-center text-muted">No recommendations available</div>';
        }

        function renderWatchlist() {
            const watchlistMovies = moviesDB.filter(m => watchlist.includes(m.id));
            const countEl = document.getElementById('watchlistCount');
            const navCountEl = document.getElementById('navWatchlistCount');
            
            countEl.textContent = `${watchlistMovies.length} thriller${watchlistMovies.length !== 1 ? 's' : ''}`;
            
            if (watchlistMovies.length > 0) {
                navCountEl.style.display = 'inline';
                navCountEl.textContent = watchlistMovies.length;
                watchlistGrid.innerHTML = watchlistMovies.map(m => createMovieCard(m)).join('');
            } else {
                navCountEl.style.display = 'none';
                watchlistGrid.innerHTML = `
                    <div class="col-12 text-center py-5 text-muted">
                        <i class="bi bi-bookmark-plus" style="font-size: 3rem;"></i>
                        <p class="mt-3">Your watchlist is empty. Start adding thrillers!</p>
                    </div>
                `;
            }
        }

        // ============================================
        // HERO SECTION
        // ============================================

        function updateHero(movie) {
            currentHeroMovie = movie;
            document.getElementById('heroBg').style.backgroundImage = `url('${movie.backdrop}')`;
            document.getElementById('heroTitle').textContent = movie.title;
            document.getElementById('heroMeta').innerHTML = `
                <span class="rating"><i class="bi bi-star-fill"></i> ${movie.rating}</span>
                <span>${movie.year}</span>
                <span>${movie.duration}</span>
                <span class="thriller-tag">Thriller</span>
            `;
            document.getElementById('heroDesc').textContent = movie.desc.length > 150 
                ? movie.desc.substring(0, 150) + '...' 
                : movie.desc;
        }

        function rotateHero() {
            if (heroMovies.length === 0) return;
            currentHeroIndex = (currentHeroIndex + 1) % Math.min(heroMovies.length, 5);
            updateHero(heroMovies[currentHeroIndex]);
        }

        // ============================================
        // INITIALIZATION
        // ============================================

        async function init() {
            if (!checkApiKey()) {
                loadingSpinner.classList.add('hidden');
                return;
            }

            const thrillers = await fetchThrillers(1);
            const topThrillers = await fetchTopThrillers(1);
            
            const combined = [...thrillers, ...topThrillers];
            const unique = Array.from(new Map(combined.map(m => [m.id, m])).values());
            
            moviesDB = unique.map(mapMovieData);
            heroMovies = moviesDB.slice(0, 5);
            
            for (let i = 0; i < Math.min(heroMovies.length, 3); i++) {
                const details = await fetchMovieDetails(heroMovies[i].id);
                if (details) {
                    heroMovies[i] = mapMovieData(details);
                }
            }

            if (heroMovies.length > 0) updateHero(heroMovies[0]);
            renderTrending();
            renderMovies();
            renderRecommended();
            renderWatchlist();
            
            loadingSpinner.classList.add('hidden');
            setInterval(rotateHero, 8000);
        }

        // ============================================
        // EVENT LISTENERS
        // ============================================

        function setupEventListeners() {
            document.querySelectorAll('.filter-pill').forEach(pill => {
                pill.addEventListener('click', async (e) => {
                    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    const genreCombo = e.target.dataset.genre;
                    currentFilter = genreCombo;
                    currentPage = 1;
                    
                    loadingSpinner.classList.remove('hidden');
                    
                    const data = await fetchThrillers(1, genreCombo);
                    moviesDB = data.map(mapMovieData);
                    
                    renderMovies();
                    renderRecommended();
                    loadingSpinner.classList.add('hidden');
                });
            });

            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(async () => {
                    const query = e.target.value.trim();
                    if (query.length > 2) {
                        loadingSpinner.classList.remove('hidden');
                        const results = await searchThrillers(query);
                        const thrillerResults = results.filter(m => 
                            m.genre_ids && m.genre_ids.includes(THRILLER_ID)
                        );
                        moviesDB = thrillerResults.map(mapMovieData);
                        renderMovies();
                        loadingSpinner.classList.add('hidden');
                    } else if (query.length === 0) {
                        loadingSpinner.classList.remove('hidden');
                        const data = await fetchThrillers(1);
                        moviesDB = data.map(mapMovieData);
                        renderMovies();
                        loadingSpinner.classList.add('hidden');
                    }
                }, 500);
            });

            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = document.querySelector(e.target.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                        e.target.classList.add('active');
                    }
                });
            });
        }

        function setupNavbarScroll() {
            window.addEventListener('scroll', () => {
                const navbar = document.querySelector('.navbar');
                navbar.classList.toggle('scrolled', window.scrollY > 50);
            });
        }

        // ============================================
        // USER ACTIONS
        // ============================================

        function toggleWatchlist(movieId) {
            const index = watchlist.indexOf(movieId);
            const movie = moviesDB.find(m => m.id === movieId);
            
            if (index > -1) {
                watchlist.splice(index, 1);
                showToast(`${movie?.title || 'Movie'} removed from watchlist`, 'info');
            } else {
                watchlist.push(movieId);
                showToast(`${movie?.title || 'Movie'} added to watchlist`, 'success');
            }
            
            localStorage.setItem('thrillstream_watchlist', JSON.stringify(watchlist));
            renderTrending();
            renderMovies();
            renderRecommended();
            renderWatchlist();
        }

        function toggleModalWatchlist() {
            if (currentModalMovie) {
                toggleWatchlist(currentModalMovie.id);
                updateModalWatchlistBtn();
            }
        }

        async function openMovieModal(movieId) {
            loadingSpinner.classList.remove('hidden');
            
            let movie = moviesDB.find(m => m.id === movieId);
            
            if (!movie || !movie.cast.length) {
                const details = await fetchMovieDetails(movieId);
                if (details) {
                    movie = mapMovieData(details);
                }
            }
            
            if (!movie) {
                showToast('Could not load movie details', 'error');
                loadingSpinner.classList.add('hidden');
                return;
            }
            
            currentModalMovie = movie;
            
            document.getElementById('modalTitle').textContent = movie.title;
            document.getElementById('modalPoster').src = movie.poster;
            document.getElementById('modalRating').innerHTML = `<i class="bi bi-star-fill"></i> ${movie.rating}`;
            document.getElementById('modalYear').textContent = movie.year;
            document.getElementById('modalDuration').textContent = movie.duration;
            document.getElementById('modalDesc').textContent = movie.desc;
            
            document.getElementById('modalGenres').innerHTML = movie.genre.map(g => 
                `<span class="tag">${g}</span>`
            ).join('');
            
            const castContainer = document.getElementById('modalCast');
            if (movie.cast.length > 0) {
                castContainer.innerHTML = movie.cast.map(actor => `
                    <div class="text-center">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(actor)}&background=8b0000&color=fff&size=60" 
                             class="cast-avatar mb-2" alt="${actor}">
                        <div class="small text-muted" style="font-size: 0.75rem; max-width: 60px;">${actor}</div>
                    </div>
                `).join('');
            } else {
                castContainer.innerHTML = '<span class="text-muted">Cast information unavailable</span>';
            }
            
            updateModalWatchlistBtn();
            loadingSpinner.classList.add('hidden');
            movieModal.show();
        }

        function updateModalWatchlistBtn() {
            const btn = document.getElementById('modalWatchlistBtn');
            const inWatchlist = watchlist.includes(currentModalMovie?.id);
            btn.innerHTML = inWatchlist ? 
                '<i class="bi bi-check-lg"></i> In Watchlist' : 
                '<i class="bi bi-plus-lg"></i> Add to Watchlist';
            btn.className = inWatchlist ? 'btn btn-success' : 'btn btn-outline-light';
        }

        async function loadMoreMovies() {
            currentPage++;
            loadingSpinner.classList.remove('hidden');
            
            const newMovies = await fetchThrillers(currentPage, currentFilter !== '53' ? currentFilter : '');
            const mapped = newMovies.map(mapMovieData);
            moviesDB = [...moviesDB, ...mapped];
            
            renderMovies();
            loadingSpinner.classList.add('hidden');
        }

        function showHeroDetails() {
            if (heroMovies[currentHeroIndex]) {
                openMovieModal(heroMovies[currentHeroIndex].id);
            }
        }

        function shareMovie() {
            if (navigator.share && currentModalMovie) {
                navigator.share({
                    title: currentModalMovie.title,
                    text: `Check out this thriller: ${currentModalMovie.title}`,
                    url: window.location.href
                });
            } else {
                showToast('Link copied to clipboard!', 'success');
            }
        }

        // ============================================
        // UTILITIES
        // ============================================

        function showToast(message, type = 'info') {
            const toastContainer = document.querySelector('.toast-container');
            const toastId = 'toast-' + Date.now();
            
            const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-dark';
            const icon = type === 'success' ? 'bi-check-circle' : type === 'error' ? 'bi-exclamation-circle' : 'bi-info-circle';
            
            const toastHTML = `
                <div id="${toastId}" class="toast align-items-center ${bgClass} text-white border-0" role="alert">
                    <div class="d-flex">
                        <div class="toast-body">
                            <i class="bi ${icon} me-2"></i>
                            ${message}
                        </div>
                        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                    </div>
                </div>
            `;
            
            toastContainer.insertAdjacentHTML('beforeend', toastHTML);
            const toast = new bootstrap.Toast(document.getElementById(toastId), { delay: 3000 });
            toast.show();
            
            document.getElementById(toastId).addEventListener('hidden.bs.toast', () => {
                document.getElementById(toastId).remove();
            });
        }

        // ============================================
        // START
        // ============================================
        document.addEventListener('DOMContentLoaded', () => {
            setupEventListeners();
            setupNavbarScroll();
            init();
        });
