;; EscrowVault.clar
;; Clarity v2
;; Manages security deposits and rent payments with escrow logic

;; Constants
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-AMOUNT u101)
(define-constant ERR-NOT-FOUND u102)
(define-constant ERR-ALREADY-LOCKED u103)
(define-constant ERR-NOT-LOCKED u104)
(define-constant ERR-ZERO-ADDRESS u105)
(define-constant ERR-INVALID-AGREEMENT u106)
(define-constant ERR-INSUFFICIENT-FUNDS u107)
(define-constant ERR-DISPUTE-ACTIVE u108)

;; Data structures
(define-data-var admin principal tx-sender)
(define-data-var rental-agreement principal 'SP000000000000000000002Q6VF78) ;; Placeholder for RentalAgreement contract

(define-map escrow-balances
  { agreement-id: uint, user: principal }
  { deposit: uint, rent: uint }
)

(define-map dispute-locks
  { agreement-id: uint }
  bool
)

;; Private helpers
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

(define-private (is-valid-agreement (agreement-id uint))
  (is-some (contract-call? (var-get rental-agreement) get-agreement agreement-id))
)

(define-private (is-agreement-party (agreement-id uint) (caller principal))
  (let
    (
      (agreement (unwrap! (contract-call? (var-get rental-agreement) get-agreement agreement-id) (err ERR-INVALID-AGREEMENT)))
    )
    (or
      (is-eq caller (get landlord agreement))
      (is-eq caller (unwrap! (get tenant agreement) (err ERR-INVALID-AGREEMENT)))
    )
  )
)

(define-private (has-dispute-lock (agreement-id uint))
  (default-to false (map-get? dispute-locks { agreement-id: agreement-id }))
)

;; Admin functions
(define-public (set-rental-agreement (contract principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set rental-agreement contract)
    (ok true)
  )
)

;; Deposit funds
(define-public (deposit (agreement-id uint) (amount uint))
  (let
    (
      (caller tx-sender)
      (escrow-key { agreement-id: agreement-id, user: caller })
      (current-escrow (default-to { deposit: u0, rent: u0 } (map-get? escrow-balances escrow-key)))
    )
    (asserts! (is-valid-agreement agreement-id) (err ERR-INVALID-AGREEMENT))
    (asserts! (is-agreement-party agreement-id caller) (err ERR-NOT-AUTHORIZED))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (not (has-dispute-lock agreement-id)) (err ERR-DISPUTE-ACTIVE))
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set escrow-balances
      escrow-key
      { deposit: (+ (get deposit current-escrow) amount), rent: (get rent current-escrow) }
    )
    (ok true)
  )
)

;; Record rent payment
(define-public (record-rent-payment (agreement-id uint) (amount uint))
  (let
    (
      (caller tx-sender)
      (escrow-key { agreement-id: agreement-id, user: caller })
      (current-escrow (default-to { deposit: u0, rent: u0 } (map-get? escrow-balances escrow-key)))
    )
    (asserts! (is-valid-agreement agreement-id) (err ERR-INVALID-AGREEMENT))
    (asserts! (is-agreement-party agreement-id caller) (err ERR-NOT-AUTHORIZED))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (not (has-dispute-lock agreement-id)) (err ERR-DISPUTE-ACTIVE))
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set escrow-balances
      escrow-key
      { deposit: (get deposit current-escrow), rent: (+ (get rent current-escrow) amount) }
    )
    (ok true)
  )
)

;; Release deposit to landlord
(define-public (release-deposit (agreement-id uint) (recipient principal))
  (let
    (
      (escrow-key { agreement-id: agreement-id, user: recipient })
      (current-escrow (unwrap! (map-get? escrow-balances escrow-key) (err ERR-NOT-FOUND)))
      (deposit-amount (get deposit current-escrow))
    )
    (asserts! (is-valid-agreement agreement-id) (err ERR-INVALID-AGREEMENT))
    (asserts! (is-agreement-party agreement-id tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> deposit-amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (not (has-dispute-lock agreement-id)) (err ERR-DISPUTE-ACTIVE))
    (try! (as-contract (stx-transfer? deposit-amount tx-sender recipient)))
    (map-set escrow-balances
      escrow-key
      { deposit: u0, rent: (get rent current-escrow) }
    )
    (ok true)
  )
)

;; Refund deposit to tenant
(define-public (refund-deposit (agreement-id uint) (recipient principal))
  (let
    (
      (escrow-key { agreement-id: agreement-id, user: recipient })
      (current-escrow (unwrap! (map-get? escrow-balances escrow-key) (err ERR-NOT-FOUND)))
      (deposit-amount (get deposit current-escrow))
    )
    (asserts! (is-valid-agreement agreement-id) (err ERR-INVALID-AGREEMENT))
    (asserts! (is-agreement-party agreement-id tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> deposit-amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (not (has-dispute-lock agreement-id)) (err ERR-DISPUTE-ACTIVE))
    (try! (as-contract (stx-transfer? deposit-amount tx-sender recipient)))
    (map-set escrow-balances
      escrow-key
      { deposit: u0, rent: (get rent current-escrow) }
    )
    (ok true)
  )
)

;; Release rent to landlord
(define-public (release-rent (agreement-id uint) (recipient principal))
  (let
    (
      (escrow-key { agreement-id: agreement-id, user: recipient })
      (current-escrow (unwrap! (map-get? escrow-balances escrow-key) (err ERR-NOT-FOUND)))
      (rent-amount (get rent current-escrow))
    )
    (asserts! (is-valid-agreement agreement-id) (err ERR-INVALID-AGREEMENT))
    (asserts! (is-agreement-party agreement-id tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> rent-amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (not (has-dispute-lock agreement-id)) (err ERR-DISPUTE-ACTIVE))
    (try! (as-contract (stx-transfer? rent-amount tx-sender recipient)))
    (map-set escrow-balances
      escrow-key
      { deposit: (get deposit current-escrow), rent: u0 }
    )
    (ok true)
  )
)

;; Lock funds during dispute
(define-public (lock-funds (agreement-id uint))
  (begin
    (asserts! (is-valid-agreement agreement-id) (err ERR-INVALID-AGREEMENT))
    (asserts! (is-agreement-party agreement-id tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (has-dispute-lock agreement-id)) (err ERR-ALREADY-LOCKED))
    (map-set dispute-locks { agreement-id: agreement-id } true)
    (ok true)
  )
)

;; Unlock funds after dispute resolution
(define-public (unlock-funds (agreement-id uint))
  (begin
    (asserts! (is-valid-agreement agreement-id) (err ERR-INVALID-AGREEMENT))
    (asserts! (is-agreement-party agreement-id tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (has-dispute-lock agreement-id) (err ERR-NOT-LOCKED))
    (map-delete dispute-locks { agreement-id: agreement-id })
    (ok true)
  )
)

;; Read-only functions
(define-read-only (get-escrow-balance (agreement-id uint) (user principal))
  (ok (default-to { deposit: u0, rent: u0 } (map-get? escrow-balances { agreement-id: agreement-id, user: user })))
)

(define-read-only (get-dispute-lock (agreement-id uint))
  (ok (default-to false (map-get? dispute-locks { agreement-id: agreement-id })))
)

(define-read-only (get-rental-agreement)
  (ok (var-get rental-agreement))
)