module AccountCacheRevalidator
  extend ActiveSupport::Concern

  included do
    after_commit :update_account_cache, on: [:create, :update, :destroy]
  end

  def update_account_cache
    account.update_cache_key(self.class.name.underscore)
  end

  # Runs the block in a transaction and bumps the account cache key once, only
  # after the commit. Used for bulk membership changes (team/inbox members):
  # bumping before the commit lets clients refetch on the broadcast, read the
  # old memberships and keep them in IndexedDB under the new cache key.
  # Must not be called inside an outer transaction, or the bump would run
  # before that outer commit.
  def revalidating_account_cache(&)
    result = self.class.transaction(&)
    update_account_cache
    result
  end
end
