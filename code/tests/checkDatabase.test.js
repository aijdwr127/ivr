const { foundDbById, foundDocsFromDbById, findFromAddedPostsById } = require('../index')

test('checks if admin exists in db', async () => {
    const response = await foundDbById('6530fc5f739c91f99bc6a8b0')
    await expect(response).not.toStrictEqual({}); // should return true, admin exists
})

test('checks if someone does not exist in db', async () => {
    const response = await foundDbById('klsjdf;lkasjf')
    await expect(response).toStrictEqual({}); // should return false because we chose random invalid id
})

test('checks if admin has posts', async () => {
    const response = await foundDocsFromDbById('6530fc5f739c91f99bc6a8b0') // should return true, admin has posts
    await expect(response).not.toStrictEqual({})
})

test('checks if some user has post he should not have', async () => {
    const response = await findFromAddedPostsById('6530fc5f739c91f99bc6a8b0', 'someRandomInvalidId') // should return false, admin doesn't have such post
    await expect(response).toStrictEqual({})
})

