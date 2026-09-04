#include <tiny-bdd.h>

int main()
{
    return tbdd::test("adding numbers")
        .then("1+1 is 2", 1 + 1 == 2);
}
